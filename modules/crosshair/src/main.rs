use base64::{engine::general_purpose::STANDARD, Engine};
use moligod_crosshair::{render, Overlay};
use moligod_module_protocol::{emit, serve, Output};
use serde_json::json;
use std::path::PathBuf;

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}
fn run() -> Result<(), String> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 3 || args[1] != "--data-dir" {
        return Err("This module must be started by moligod.".into());
    }
    let directory = PathBuf::from(&args[2]);
    let output: Output = std::sync::Arc::new(std::sync::Mutex::new(std::io::stdout()));
    let events = output.clone();
    let mut overlay = Overlay::new(directory.clone(), move |status| {
        emit(&events, "crosshair-state", status)
    });
    let result = serve("crosshair", output, |method, payload| {
        let value = match method {
            "start" => serde_json::to_value(
                overlay.start(serde_json::from_value(payload).map_err(|e| e.to_string())?)?,
            ),
            "apply" => serde_json::to_value(
                overlay.apply(serde_json::from_value(payload).map_err(|e| e.to_string())?)?,
            ),
            "stop" | "shutdown" => serde_json::to_value(overlay.stop()?),
            "show" => serde_json::to_value(overlay.show(true)?),
            "hide" => serde_json::to_value(overlay.show(false)?),
            "status" => serde_json::to_value(overlay.status()),
            "capture-on" => serde_json::to_value(overlay.capture(true)?),
            "capture-off" => serde_json::to_value(overlay.capture(false)?),
            "monitors" => serde_json::to_value(moligod_crosshair::monitors()?),
            "import-image" => {
                let bytes = STANDARD
                    .decode(payload.as_str().ok_or("图片数据无效")?)
                    .map_err(|e| e.to_string())?;
                return Ok(json!(render::import_image(&bytes, &directory)?));
            }
            "image-preview" => {
                let bytes =
                    render::preview_png(payload.as_str().ok_or("图片标识无效")?, &directory)?;
                return Ok(json!(STANDARD.encode(bytes)));
            }
            _ => return Err("未知准星模块操作".into()),
        };
        value.map_err(|e| e.to_string())
    });
    let _ = overlay.stop();
    result
}
