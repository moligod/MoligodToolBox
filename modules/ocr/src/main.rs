//! Native, offline OCR subprocess. Rust owns image processing and ORT calls.
mod pipeline;

use ort::{environment::Environment, ep, logging::LogLevel, session::Session};
use serde_json::{json, Value};
use std::{
    io::{self, BufRead, Read, Write},
    path::{Path, PathBuf},
};
type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;

fn emit(value: Value) -> Result<()> {
    let mut output = io::stdout().lock();
    serde_json::to_writer(&mut output, &value)?;
    output.write_all(b"\n")?;
    output.flush()?;
    Ok(())
}

fn arg(name: &str) -> Result<String> {
    let args: Vec<_> = std::env::args().collect();
    let i = args
        .iter()
        .position(|v| v == name)
        .ok_or_else(|| format!("missing {name}"))?;
    args.get(i + 1)
        .cloned()
        .ok_or_else(|| format!("missing value for {name}").into())
}

#[cfg(windows)]
fn directml_adapter() -> Result<i32> {
    use windows::{
        core::Interface,
        Win32::Graphics::Dxgi::{
            CreateDXGIFactory1, IDXGIAdapter1, IDXGIFactory1, IDXGIFactory6,
            DXGI_ADAPTER_FLAG_SOFTWARE, DXGI_GPU_PREFERENCE_HIGH_PERFORMANCE,
        },
    };
    let factory: IDXGIFactory1 = unsafe { CreateDXGIFactory1()? };
    let preferred = factory
        .cast::<IDXGIFactory6>()
        .ok()
        .and_then(|factory| unsafe {
            factory
                .EnumAdapterByGpuPreference::<IDXGIAdapter1>(
                    0,
                    DXGI_GPU_PREFERENCE_HIGH_PERFORMANCE,
                )
                .ok()
        })
        .and_then(|adapter| unsafe { adapter.GetDesc1().ok() })
        .map(|desc| desc.AdapterLuid);
    let mut fallback = None;
    for index in 0..32 {
        let Ok(adapter) = (unsafe { factory.EnumAdapters1(index) }) else {
            break;
        };
        let desc = unsafe { adapter.GetDesc1()? };
        if desc.Flags & DXGI_ADAPTER_FLAG_SOFTWARE.0 as u32 != 0 {
            continue;
        }
        fallback.get_or_insert(index as i32);
        // DirectML expects the EnumAdapters1 index, not the GPU-preference rank.
        if preferred.is_some_and(|luid| {
            luid.HighPart == desc.AdapterLuid.HighPart && luid.LowPart == desc.AdapterLuid.LowPart
        }) {
            return Ok(index as i32);
        }
    }
    fallback.ok_or_else(|| "未检测到可用显卡，请选择 CPU 识别".into())
}
#[cfg(not(windows))]
fn directml_adapter() -> Result<i32> {
    Err("显卡识别仅支持 Windows".into())
}

fn session(path: &Path, device: &str) -> Result<Session> {
    let mut builder = Session::builder()?
        .with_intra_threads(2)?
        .with_inter_threads(1)?
        .with_parallel_execution(false)?;
    if let Some(directory) = std::env::var_os("MOLIGOD_OCR_PROFILE_DIR") {
        let directory = PathBuf::from(directory);
        std::fs::create_dir_all(&directory)?;
        builder = builder
            .with_profiling(directory.join(path.file_stem().ok_or("invalid model path")?))?;
    }
    match device {
        "cpu" => {
            builder = builder
                .with_execution_providers([ep::CPU::default().build().error_on_failure()])?;
        }
        "amd" | "dml-test" => {
            let index = if device == "dml-test" {
                0
            } else {
                directml_adapter()?
            };
            builder = builder
                .with_memory_pattern(false)?
                .with_execution_providers([ep::DirectML::default()
                    .with_device_id(index)
                    .build()
                    .error_on_failure()])?;
        }
        "nvidia" => {
            builder = builder.with_memory_pattern(false)?;
            builder = builder
                .with_optimization_level(ort::session::builder::GraphOptimizationLevel::Disable)?;
            let env = Environment::current()?;
            let devices: Vec<_> = env
                .devices()
                .filter(|d| d.ep().ok() == Some("NvTensorRTRTXExecutionProvider"))
                .collect();
            if devices.is_empty() {
                return Err("未找到 TensorRT RTX 设备，需要 RTX 30 系或更新显卡及兼容驱动".into());
            }
            // Explicit static dimensions avoid incorrect dynamic-shape results in RTX EP.
            // The pipeline pads rather than stretching images to these dimensions.
            let detection = path.file_stem().is_some_and(|name| name == "det");
            let side = i64::from(pipeline::DETECTOR_SIDE);
            builder = builder.with_dimension_override("DynamicDimension.0", 1)?;
            builder = builder.with_dimension_override(
                "DynamicDimension.1",
                if detection { side } else { 3200 },
            )?;
            if detection {
                builder = builder.with_dimension_override("DynamicDimension.2", side)?;
            }
            let options = vec![
                (
                    "NvTensorRTRTXExecutionProvider.nv_runtime_cache_path".into(),
                    String::new(),
                ),
                (
                    "NvTensorRTRTXExecutionProvider.enable_cuda_graph".into(),
                    "0".into(),
                ),
            ];
            builder = builder.with_devices(devices.into_iter().take(1), Some(&options))?;
        }
        _ => return Err("未知 OCR 识别方式".into()),
    }
    Ok(builder.commit_from_file(path)?)
}

fn run() -> Result<()> {
    let model = arg("--model")?;
    if !["small", "tiny"].contains(&model.as_str()) {
        return Err("未知 OCR 模型".into());
    }
    let device = arg("--device")?;
    let models = PathBuf::from(arg("--models")?);
    let root = std::env::current_exe()?
        .parent()
        .ok_or("invalid OCR directory")?
        .to_owned();
    let native = root.join(if device == "nvidia" {
        "nvidia"
    } else {
        "directml"
    });
    // Only local, explicitly bundled DLLs. No package manager or network at runtime.
    ort::init_from(native.join("onnxruntime.dll"))?
        .with_name("moligod-ocr")
        .with_telemetry(false)
        .commit();
    let env = Environment::current()?;
    env.set_log_level(LogLevel::Error);
    let _plugin = if device == "nvidia" {
        Some(env.register_ep_library(
            "NvTensorRTRTXExecutionProvider",
            native.join("onnxruntime_providers_nv_tensorrt_rtx.dll"),
        )?)
    } else {
        None
    };
    let directory = models.join(&model);
    let config: pipeline::Config =
        serde_json::from_slice(&std::fs::read(directory.join("config.json"))?)?;
    let mut engine = pipeline::Engine::new(
        session(&directory.join("det.onnx"), &device)?,
        session(&directory.join("rec.onnx"), &device)?,
        config,
        device == "nvidia",
    )?;
    emit(json!({"ready":true,"model":model,"device":device,"runtime":"rust"}))?;
    let mut input = io::stdin().lock();
    loop {
        let mut line = Vec::new();
        if (&mut input).take(32769).read_until(b'\n', &mut line)? == 0 {
            break;
        }
        if line.len() > 32768 || !line.ends_with(b"\n") {
            return Err("OCR 请求超过限制".into());
        }
        let request = (|| -> Result<String> {
            let value: Value = serde_json::from_slice(&line)?;
            let path = value["image"].as_str().ok_or("缺少 OCR 图片")?;
            let reader = image::ImageReader::open(path)?.with_guessed_format()?;
            let (w, h) = reader.into_dimensions()?;
            if w == 0 || h == 0 || w.max(h) > 8192 || u64::from(w) * u64::from(h) > 16_777_216 {
                return Err("OCR 图片超过尺寸限制".into());
            }
            let image = image::open(path)?.to_rgb8();
            engine.recognize(&image)
        })();
        match request {
            Ok(text) => emit(json!({"text":text,"model":model,"device":device}))?,
            Err(error) => {
                emit(json!({"error":error.to_string().chars().take(2048).collect::<String>()}))?
            }
        }
    }
    Ok(())
}

fn main() {
    if let Err(error) = run() {
        let _ = emit(json!({"error":error.to_string().chars().take(2048).collect::<String>()}));
        std::process::exit(1);
    }
}
