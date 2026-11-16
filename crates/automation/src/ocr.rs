//! Bounded, cancellable IPC to the bundled native Rust PP-OCRv6 process.
use crate::{model::OcrModel, ocr_settings::OcrDevice};
use image::RgbaImage;
use moligod_core::task::Cancellation;
use serde_json::{json, Value};
use std::{
    io::{BufRead, BufReader, Read, Write},
    path::Path,
    process::{Child, ChildStdin, Command, Stdio},
    sync::mpsc::{self, Receiver, RecvTimeoutError},
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};

pub struct OcrWorker {
    model: OcrModel,
    device: OcrDevice,
    child: Child,
    input: ChildStdin,
    replies: Receiver<Result<Value, String>>,
    reader: Option<JoinHandle<()>>,
}

impl OcrWorker {
    pub fn model(&self) -> OcrModel {
        self.model
    }

    pub fn device(&self) -> OcrDevice {
        self.device
    }

    pub fn start(
        model: OcrModel,
        device: OcrDevice,
        cancel: &Cancellation,
    ) -> Result<Self, String> {
        let executable = std::env::current_exe().map_err(|e| e.to_string())?;
        let root = executable
            .parent()
            .ok_or("OCR 模块目录无效")?
            .join("ocr-runtime");
        Self::start_at(&root, model, device, cancel)
    }

    fn start_at(
        root: &Path,
        model: OcrModel,
        device: OcrDevice,
        cancel: &Cancellation,
    ) -> Result<Self, String> {
        if cancel.is_cancelled() {
            return Err("OCR 已取消".into());
        }
        let mut command = Command::new(root.join("moligod-ocr.exe"));
        command
            .args([
                "--model",
                model.name(),
                "--device",
                device.name(),
                "--models",
            ])
            .arg(root.join("models"))
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000);
        }
        let mut child = command
            .spawn()
            .map_err(|e| format!("启动 PP-OCRv6 失败，请检查 OCR 模块资源：{e}"))?;
        let input = child.stdin.take().expect("piped stdin");
        let output = child.stdout.take().expect("piped stdout");
        let (send, replies) = mpsc::sync_channel(1);
        let reader = match thread::Builder::new()
            .name("ocr-output".into())
            .spawn(move || {
                let mut output = BufReader::new(output);
                loop {
                    let mut line = Vec::new();
                    let value = match (&mut output).take(32769).read_until(b'\n', &mut line) {
                        Ok(0) => break,
                        Ok(_) if line.len() <= 32768 && line.ends_with(b"\n") => {
                            serde_json::from_slice(&line).map_err(|_| "OCR 返回格式无效".into())
                        }
                        _ => Err("OCR 返回超过限制或通道已关闭".into()),
                    };
                    let failed = value.is_err();
                    if send.try_send(value).is_err() || failed {
                        break;
                    }
                }
            }) {
            Ok(reader) => reader,
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(error.to_string());
            }
        };
        let worker = Self {
            model,
            device,
            child,
            input,
            replies,
            reader: Some(reader),
        };
        let ready = worker.wait(
            cancel,
            Duration::from_secs(if device == OcrDevice::Nvidia { 120 } else { 10 }),
        )?;
        if ready["ready"] != true
            || ready["model"] != model.name()
            || ready["device"] != device.name()
            || ready["runtime"] != "rust"
        {
            return Err("PP-OCRv6 模型握手不匹配".into());
        }
        Ok(worker)
    }

    fn wait(&self, cancel: &Cancellation, timeout: Duration) -> Result<Value, String> {
        let started = Instant::now();
        loop {
            if cancel.is_cancelled() {
                return Err("OCR 已取消".into());
            }
            if started.elapsed() >= timeout {
                return Err("PP-OCRv6 识别超时".into());
            }
            match self.replies.recv_timeout(Duration::from_millis(20)) {
                Ok(value) => {
                    let value = value?;
                    if let Some(error) = value.get("error").and_then(Value::as_str) {
                        return Err(error.chars().take(2048).collect());
                    }
                    return Ok(value);
                }
                Err(RecvTimeoutError::Timeout) => {}
                Err(RecvTimeoutError::Disconnected) => return Err("PP-OCRv6 进程已退出".into()),
            }
        }
    }

    pub fn recognize(
        &mut self,
        image: &RgbaImage,
        cancel: &Cancellation,
    ) -> Result<String, String> {
        if cancel.is_cancelled() {
            return Err("OCR 已取消".into());
        }
        if image.width() == 0
            || image.height() == 0
            || image.width().max(image.height()) > 8192
            || u64::from(image.width()) * u64::from(image.height()) > 16_777_216
        {
            return Err("OCR 图片超过尺寸限制".into());
        }
        let file = tempfile::Builder::new()
            .suffix(".png")
            .tempfile()
            .map_err(|e| e.to_string())?;
        image
            .save_with_format(file.path(), image::ImageFormat::Png)
            .map_err(|e| e.to_string())?;
        serde_json::to_writer(&mut self.input, &json!({"image":file.path()}))
            .map_err(|e| e.to_string())?;
        self.input
            .write_all(b"\n")
            .and_then(|()| self.input.flush())
            .map_err(|e| e.to_string())?;
        let reply = self.wait(
            cancel,
            Duration::from_secs(if self.device == OcrDevice::Nvidia {
                120
            } else {
                15
            }),
        )?;
        if reply["model"] != self.model.name() || reply["device"] != self.device.name() {
            return Err("OCR 返回模型不匹配".into());
        }
        reply
            .get("text")
            .and_then(Value::as_str)
            .map(|text| text.chars().take(4096).collect())
            .ok_or_else(|| "OCR 缺少识别结果".into())
    }
}

impl Drop for OcrWorker {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
        if let Some(reader) = self.reader.take() {
            let _ = reader.join();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cancellation_prevents_starting_a_process() {
        let token = Cancellation::default();
        token.cancel();
        let result = OcrWorker::start_at(
            Path::new("missing-runtime"),
            OcrModel::Small,
            OcrDevice::Cpu,
            &token,
        );
        assert!(result.err().unwrap().contains("取消"));
    }

    #[test]
    #[ignore = "requires native RTX resources and a compatible NVIDIA GPU"]
    fn offline_rtx_models_survive_restarts_and_shape_changes() {
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../target/ocr-runtime");
        let fixture =
            Path::new(env!("CARGO_MANIFEST_DIR")).join("../../tests/fixtures/ocr-bilingual.png");
        let image = image::open(fixture).unwrap().to_rgba8();
        let blank = RgbaImage::from_pixel(100, 100, image::Rgba([255, 255, 255, 255]));
        let token = Cancellation::default();
        for model in [OcrModel::Small, OcrModel::Tiny] {
            for _ in 0..2 {
                let mut worker =
                    OcrWorker::start_at(&root, model, OcrDevice::Nvidia, &token).unwrap();
                for _ in 0..2 {
                    let result = worker.recognize(&image, &token).unwrap();
                    assert_eq!(result.replace(' ', ""), "中文识别测试12345\nMOLIGOD67890");
                    assert_eq!(worker.recognize(&blank, &token).unwrap(), "");
                }
            }
        }
    }

    #[test]
    #[ignore = "requires the prepared native runtime; run after scripts/prepare-ocr.ps1 and modules build"]
    fn offline_models_recognize_bilingual_text_and_release_process() {
        use windows_sys::Win32::{
            Foundation::CloseHandle,
            System::Threading::{OpenProcess, WaitForSingleObject, PROCESS_SYNCHRONIZE},
        };
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../target/ocr-runtime");
        let fixture =
            Path::new(env!("CARGO_MANIFEST_DIR")).join("../../tests/fixtures/ocr-bilingual.png");
        let image = image::open(fixture).unwrap().to_rgba8();
        let token = Cancellation::default();
        for model in [OcrModel::Small, OcrModel::Tiny] {
            let mut worker = OcrWorker::start_at(&root, model, OcrDevice::Cpu, &token).unwrap();
            let process = unsafe { OpenProcess(PROCESS_SYNCHRONIZE, 0, worker.child.id()) };
            assert!(!process.is_null());
            let result = worker.recognize(&image, &token).unwrap();
            assert_eq!(result, "中文识别测试 12345\nMOLIGOD 67890");
            assert_eq!(
                crate::ocr_value::format_result(&result, true, true).unwrap(),
                serde_json::json!(1234567890.0)
            );
            let blank = RgbaImage::from_pixel(100, 100, image::Rgba([255, 255, 255, 255]));
            let empty = worker.recognize(&blank, &token).unwrap();
            assert_eq!(empty, "");
            assert_eq!(
                crate::ocr_value::format_result(&empty, true, true).unwrap(),
                serde_json::Value::Null
            );
            let cancelled = Cancellation::default();
            cancelled.cancel();
            assert!(worker
                .recognize(&image, &cancelled)
                .unwrap_err()
                .contains("取消"));
            let during = Cancellation::default();
            let signal = during.clone();
            let interrupt = thread::spawn(move || {
                thread::sleep(Duration::from_millis(1));
                signal.cancel();
            });
            assert!(worker
                .recognize(&image, &during)
                .unwrap_err()
                .contains("取消"));
            interrupt.join().unwrap();
            drop(worker);
            assert_eq!(unsafe { WaitForSingleObject(process, 1000) }, 0);
            unsafe {
                CloseHandle(process);
            }
        }
        let cancel = Cancellation::default();
        let signal = cancel.clone();
        let interrupt = thread::spawn(move || {
            thread::sleep(Duration::from_millis(10));
            signal.cancel();
        });
        assert!(
            OcrWorker::start_at(&root, OcrModel::Small, OcrDevice::Cpu, &cancel)
                .err()
                .unwrap()
                .contains("取消")
        );
        interrupt.join().unwrap();
    }
}
