//! Bounded, cancellable IPC to the bundled native Rust PP-OCRv6 process.
use crate::{model::OcrModel, ocr_settings::OcrDevice};
use image::RgbaImage;
use moligod_core::task::Cancellation;
use serde_json::{json, Value};
use std::{
    io::{BufRead, BufReader, Read, Write},
    path::{Path, PathBuf},
    process::{Child, ChildStdin, Command, Stdio},
    sync::{
        mpsc::{self, Receiver, RecvTimeoutError},
        Arc, Condvar, Mutex,
    },
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
    busy: bool,
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
            .current_dir(root)
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
        let mut worker = Self {
            model,
            device,
            child,
            input,
            replies,
            reader: Some(reader),
            busy: false,
        };
        let ready = worker.wait(
            cancel,
            Instant::now()
                + Duration::from_secs(if device == OcrDevice::Nvidia { 120 } else { 10 }),
        )?;
        if ready["ready"] != true
            || ready["model"] != model.name()
            || ready["device"] != device.name()
            || ready["runtime"] != "rust"
            || ready["protocol"] != 2
        {
            return Err("PP-OCRv6 模型握手不匹配".into());
        }
        Ok(worker)
    }

    fn wait(&mut self, cancel: &Cancellation, deadline: Instant) -> Result<Value, String> {
        let value = receive_until(&self.replies, cancel, deadline)?;
        self.busy = false;
        if let Some(error) = value.get("error").and_then(Value::as_str) {
            return Err(error.chars().take(2048).collect());
        }
        Ok(value)
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
        // A request that timed out or was cancelled may still be answered later; that
        // reply would be read as this image's text.
        if self.busy {
            return Err("OCR 进程仍在处理上一张图片，请重试".into());
        }
        self.busy = true;
        let timeout = Duration::from_secs(if self.device == OcrDevice::Nvidia {
            120
        } else {
            15
        });
        let deadline = Instant::now() + timeout;
        let input = &mut self.input;
        thread::scope(|scope| -> Result<(), String> {
            let (sent, written) = mpsc::channel();
            thread::Builder::new()
                .name("ocr-input".into())
                .spawn_scoped(scope, move || {
                    let _ = sent.send(send_rgb(input, image).map_err(|e| e.to_string()));
                })
                .map_err(|e| e.to_string())?;
            let result = receive_until(&written, cancel, deadline);
            if result.is_err() {
                // Closing the child's pipe reader releases a blocked writer before scope joins it.
                let _ = self.child.kill();
            }
            result
        })?;
        let reply = self.wait(cancel, deadline)?;
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

fn receive_until<T>(
    rx: &Receiver<Result<T, String>>,
    cancel: &Cancellation,
    deadline: Instant,
) -> Result<T, String> {
    loop {
        if cancel.is_cancelled() {
            return Err("OCR 已取消".into());
        }
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            return Err("PP-OCRv6 识别超时".into());
        }
        match rx.recv_timeout(remaining.min(Duration::from_millis(20))) {
            Ok(result) => return result,
            Err(RecvTimeoutError::Timeout) => continue,
            Err(RecvTimeoutError::Disconnected) => return Err("PP-OCRv6 进程已退出".into()),
        }
    }
}

/// Quiet period after which a worker kept for manual tests is released.
const MANUAL_IDLE: Duration = Duration::from_secs(60);

struct Kept<T> {
    value: Option<(T, Instant)>,
    reaping: bool,
}

/// Holds one value and drops it after `idle` without use, on `release`, or with the slot.
/// The timer thread exists only while a value is held and waits on a condition variable.
struct IdleSlot<T: Send + 'static> {
    idle: Duration,
    kept: Arc<(Mutex<Kept<T>>, Condvar)>,
    reaper: Option<JoinHandle<()>>,
}

impl<T: Send + 'static> IdleSlot<T> {
    fn new(idle: Duration) -> Self {
        Self {
            idle,
            kept: Arc::new((
                Mutex::new(Kept {
                    value: None,
                    reaping: false,
                }),
                Condvar::new(),
            )),
            reaper: None,
        }
    }

    fn take(&self) -> Option<T> {
        let value = self
            .kept
            .0
            .lock()
            .ok()?
            .value
            .take()
            .map(|(value, _)| value);
        self.kept.1.notify_all();
        value
    }

    fn keep(&mut self, value: T) {
        let start = {
            let Ok(mut kept) = self.kept.0.lock() else {
                return;
            };
            kept.value = Some((value, Instant::now()));
            !std::mem::replace(&mut kept.reaping, true)
        };
        self.kept.1.notify_all();
        if !start {
            return;
        }
        // The previous timer gave up its claim; at most it is still dropping an expired value.
        if let Some(previous) = self.reaper.take() {
            let _ = previous.join();
        }
        let (kept, idle) = (self.kept.clone(), self.idle);
        match thread::Builder::new()
            .name("ocr-idle".into())
            .spawn(move || reap(&kept, idle))
        {
            Ok(reaper) => self.reaper = Some(reaper),
            // Without a timer the value stays until `release` or drop.
            Err(_) => {
                if let Ok(mut kept) = self.kept.0.lock() {
                    kept.reaping = false;
                }
            }
        }
    }

    fn release(&mut self) {
        drop(self.take());
    }
}

fn reap<T>(kept: &(Mutex<Kept<T>>, Condvar), idle: Duration) {
    let Ok(mut guard) = kept.0.lock() else {
        return;
    };
    loop {
        let Some(quiet) = guard.value.as_ref().map(|(_, used)| used.elapsed()) else {
            guard.reaping = false;
            return;
        };
        if quiet >= idle {
            let expired = guard.value.take();
            guard.reaping = false;
            drop(guard);
            drop(expired);
            return;
        }
        guard = match kept.1.wait_timeout(guard, idle - quiet) {
            Ok((guard, _)) => guard,
            Err(_) => return,
        };
    }
}

impl<T: Send + 'static> Drop for IdleSlot<T> {
    fn drop(&mut self) {
        self.release();
        if let Some(reaper) = self.reaper.take() {
            let _ = reaper.join();
        }
    }
}

/// One worker kept between manual editor tests, so retesting a region skips process start
/// and model load (seconds for TensorRT RTX). It is released after `MANUAL_IDLE` without a
/// test, by `release`, after a failed test, or when this value is dropped.
pub struct ManualOcr {
    directory: PathBuf,
    worker: IdleSlot<OcrWorker>,
}

impl ManualOcr {
    pub fn new(directory: PathBuf) -> Self {
        Self {
            directory,
            worker: IdleSlot::new(MANUAL_IDLE),
        }
    }

    pub fn recognize(
        &mut self,
        image: &RgbaImage,
        cancel: &Cancellation,
    ) -> Result<String, String> {
        // Settings are read per test so a changed model or device applies immediately.
        let settings = crate::ocr_settings::load(&self.directory)?;
        let mut worker = match self.worker.take() {
            Some(worker)
                if worker.model() == settings.model && worker.device() == settings.device =>
            {
                worker
            }
            _ => OcrWorker::start(settings.model, settings.device, cancel)?,
        };
        let result = worker.recognize(image, cancel);
        if result.is_ok() {
            self.worker.keep(worker);
        }
        result
    }

    pub fn release(&mut self) {
        self.worker.release();
    }
}

/// Header line plus raw RGB rows; the alpha channel is dropped while copying through a
/// bounded buffer, so no encoded image or temporary file is created.
fn send_rgb(output: &mut impl Write, image: &RgbaImage) -> std::io::Result<()> {
    serde_json::to_writer(
        &mut *output,
        &json!({"width":image.width(),"height":image.height(),"format":"rgb8"}),
    )?;
    output.write_all(b"\n")?;
    let mut buffer = vec![0; 3 * 65536];
    for pixels in image.as_raw().chunks(4 * 65536) {
        let filled = pixels.len() / 4 * 3;
        for (rgb, rgba) in buffer[..filled]
            .chunks_exact_mut(3)
            .zip(pixels.chunks_exact(4))
        {
            rgb.copy_from_slice(&rgba[..3]);
        }
        output.write_all(&buffer[..filled])?;
    }
    output.flush()
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
    fn nonreading_child_fixture() {
        if std::env::var_os("MOLIGOD_OCR_TEST_STALL").is_some() {
            // Safety bound if the parent fails to terminate this fixture.
            thread::sleep(Duration::from_secs(6));
        }
    }

    #[test]
    fn cancellation_interrupts_a_full_child_input_pipe() {
        let image = RgbaImage::new(2048, 2048);
        let mut child = Command::new(std::env::current_exe().unwrap())
            .args(["--exact", "ocr::tests::nonreading_child_fixture"])
            .env("MOLIGOD_OCR_TEST_STALL", "1")
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .spawn()
            .unwrap();
        let (_tx, replies) = mpsc::channel();
        let mut worker = OcrWorker {
            model: OcrModel::Small,
            device: OcrDevice::Cpu,
            input: child.stdin.take().unwrap(),
            child,
            replies,
            reader: None,
            busy: false,
        };
        let cancel = Cancellation::default();
        let trigger = cancel.clone();
        let started = Instant::now();
        let timer = thread::spawn(move || {
            thread::sleep(Duration::from_millis(250));
            trigger.cancel();
        });
        let result = worker.recognize(&image, &cancel);
        drop(worker);
        timer.join().unwrap();
        assert!(result.unwrap_err().contains("取消"));
        assert!(started.elapsed() < Duration::from_secs(3));
    }

    #[test]
    fn raw_request_is_a_header_and_rgb_rows_across_buffer_boundaries() {
        for (w, h) in [(3, 2), (300, 300)] {
            let image = RgbaImage::from_fn(w, h, |x, y| {
                image::Rgba([x as u8, y as u8, (x ^ y) as u8, 200])
            });
            let mut out = Vec::new();
            send_rgb(&mut out, &image).unwrap();
            let newline = out.iter().position(|&byte| byte == b'\n').unwrap();
            let header: Value = serde_json::from_slice(&out[..newline]).unwrap();
            assert_eq!(header, json!({"width":w,"height":h,"format":"rgb8"}));
            let expected: Vec<u8> = image
                .pixels()
                .flat_map(|pixel| [pixel[0], pixel[1], pixel[2]])
                .collect();
            assert_eq!(&out[newline + 1..], expected.as_slice());
        }
    }

    #[test]
    fn idle_slot_expires_renews_and_releases_its_value() {
        use std::sync::atomic::{AtomicUsize, Ordering};
        struct Probe(Arc<AtomicUsize>);
        impl Drop for Probe {
            fn drop(&mut self) {
                self.0.fetch_add(1, Ordering::SeqCst);
            }
        }
        let drops = Arc::new(AtomicUsize::new(0));
        let settle = |count| {
            let started = Instant::now();
            while drops.load(Ordering::SeqCst) != count {
                assert!(started.elapsed() < Duration::from_secs(5));
                thread::sleep(Duration::from_millis(5));
            }
        };
        let mut quick = IdleSlot::new(Duration::from_millis(30));
        quick.keep(Probe(drops.clone()));
        settle(1);
        assert!(quick.take().is_none());
        // A value kept after the timer exited starts a new one.
        quick.keep(Probe(drops.clone()));
        settle(2);
        let mut slow = IdleSlot::new(Duration::from_secs(600));
        slow.keep(Probe(drops.clone()));
        let probe = slow.take().unwrap();
        slow.keep(probe);
        assert_eq!(drops.load(Ordering::SeqCst), 2);
        slow.release();
        assert_eq!(drops.load(Ordering::SeqCst), 3);
        slow.keep(Probe(drops.clone()));
        drop(slow);
        drop(quick);
        assert_eq!(drops.load(Ordering::SeqCst), 4);
    }

    /// Parent-to-reply latency, including image transport. Run after scripts/prepare-ocr.ps1:
    /// cargo test -p moligod-automation --release -- --ignored --nocapture end_to_end_timings
    /// BENCH_DEVICE=cpu|amd|nvidia and BENCH_MODEL=small|tiny select the worker.
    #[test]
    #[ignore = "requires target/ocr-runtime and target/ocr-large-check images"]
    fn end_to_end_timings() {
        let target = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../target");
        let model = match std::env::var("BENCH_MODEL").as_deref() {
            Ok("tiny") => OcrModel::Tiny,
            _ => OcrModel::Small,
        };
        let device = match std::env::var("BENCH_DEVICE").as_deref() {
            Ok("amd") => OcrDevice::Amd,
            Ok("nvidia") => OcrDevice::Nvidia,
            _ => OcrDevice::Cpu,
        };
        let checks = target.join("ocr-large-check");
        let full = image::open(checks.join("1080p.png")).unwrap().to_rgba8();
        let crop = |x, y, w, h| image::imageops::crop_imm(&full, x, y, w, h).to_image();
        let cases = [
            ("num-320x48", crop(870, 290, 320, 48)),
            ("panel-640x360", crop(800, 200, 640, 360)),
            ("1080p", full.clone()),
            ("4k", image::open(checks.join("4k.png")).unwrap().to_rgba8()),
        ];
        let token = Cancellation::default();
        let started = Instant::now();
        let mut worker =
            OcrWorker::start_at(&target.join("ocr-runtime"), model, device, &token).unwrap();
        println!(
            "{} {} start {:.1} ms",
            model.name(),
            device.name(),
            started.elapsed().as_secs_f64() * 1e3
        );
        for (name, image) in cases {
            let mut times = Vec::new();
            let mut text = String::new();
            for _ in 0..6 {
                let started = Instant::now();
                text = worker.recognize(&image, &token).unwrap();
                times.push(started.elapsed().as_secs_f64() * 1e3);
            }
            let first = times.remove(0);
            times.sort_by(f64::total_cmp);
            println!(
                "{} {} {name}: first {first:.1} median {:.1} ms; {:?}",
                model.name(),
                device.name(),
                times[times.len() / 2],
                text.replace('\n', "|")
            );
        }
    }

    #[test]
    #[ignore = "requires native RTX resources and a compatible NVIDIA GPU"]
    fn offline_rtx_models_survive_restarts_and_shape_changes() {
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../target/ocr-runtime");
        let fixtures = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../tests/fixtures");
        let image = image::open(fixtures.join("ocr-bilingual.png"))
            .unwrap()
            .to_rgba8();
        let large = image::open(fixtures.join("ocr-4k-small-text.png"))
            .unwrap()
            .to_rgba8();
        // A small crop of a dark UI: most of the fixed 960×960 detector input is padding.
        let panel = image::imageops::crop_imm(&large, 1600, 540, 640, 360).to_image();
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
                    let result = worker.recognize(&panel, &token).unwrap();
                    assert_eq!(result.replace(' ', ""), "库存2846", "{model:?} panel");
                    assert_eq!(
                        worker.recognize(&large, &token).unwrap().replace(' ', ""),
                        "任务目标\n库存2846\n交易价格59372\n库存记录123456789024680\n装备数量128\n剩余时间09:45\n备件7318\n余额4962\n当前价格318",
                        "{model:?} 4K"
                    );
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
        let fixtures = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../tests/fixtures");
        let image = image::open(fixtures.join("ocr-bilingual.png"))
            .unwrap()
            .to_rgba8();
        let large = image::open(fixtures.join("ocr-4k-small-text.png"))
            .unwrap()
            .to_rgba8();
        let token = Cancellation::default();
        for model in [OcrModel::Small, OcrModel::Tiny] {
            let mut worker = OcrWorker::start_at(&root, model, OcrDevice::Cpu, &token).unwrap();
            let process = unsafe { OpenProcess(PROCESS_SYNCHRONIZE, 0, worker.child.id()) };
            assert!(!process.is_null());
            let result = worker.recognize(&image, &token).unwrap();
            assert_eq!(result, "中文识别测试 12345\nMOLIGOD 67890");
            // Includes low-contrast small print and a line that crosses the tile seam.
            assert_eq!(
                worker.recognize(&large, &token).unwrap().replace(' ', ""),
                "任务目标\n库存2846\n交易价格59372\n库存记录123456789024680\n装备数量128\n剩余时间09:45\n备件7318\n余额4962\n当前价格318"
            );
            assert_eq!(
                crate::ocr_value::format_result(&result, true, true).unwrap(),
                serde_json::json!(1234567890)
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
            // The 4K page takes far longer than one cancellation check; the small page can
            // now finish before the interrupt thread runs.
            assert!(worker
                .recognize(&large, &during)
                .unwrap_err()
                .contains("取消"));
            assert!(worker
                .recognize(&image, &token)
                .unwrap_err()
                .contains("上一张"));
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
