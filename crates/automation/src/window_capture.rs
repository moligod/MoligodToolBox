use crate::model::{BoundWindow, Region};
use image::RgbaImage;
use moligod_core::task::Cancellation;
use std::{
    sync::{mpsc, Arc, Mutex},
    time::{Duration, Instant},
};
use windows_capture::{
    capture::{CaptureControl, Context, GraphicsCaptureApiHandler},
    frame::Frame,
    graphics_capture_api::InternalCaptureControl,
    settings::*,
    window::Window,
};
use windows_sys::Win32::{
    Foundation::*,
    Graphics::{Dwm::*, Gdi::ClientToScreen},
    System::Performance::{QueryPerformanceCounter, QueryPerformanceFrequency},
    UI::{HiDpi::*, WindowsAndMessaging::*},
};
struct Flags {
    window: BoundWindow,
    region: Region,
    sender: mpsc::SyncSender<Result<RgbaImage, String>>,
}
struct OneFrame(Flags);
fn copy_frame(window: &BoundWindow, r: Region, frame: &mut Frame) -> Result<RgbaImage, String> {
    unsafe {
        SetThreadDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
    }
    let hwnd = window.hwnd as HWND;
    let mut pid = 0;
    unsafe {
        GetWindowThreadProcessId(hwnd, &mut pid);
    }
    if pid != window.pid {
        return Err("截图目标已变化".into());
    }
    let mut client: RECT = unsafe { std::mem::zeroed() };
    let mut bounds: RECT = unsafe { std::mem::zeroed() };
    let mut origin = POINT { x: 0, y: 0 };
    if unsafe { GetClientRect(hwnd, &mut client) } == 0
        || unsafe { ClientToScreen(hwnd, &mut origin) } == 0
    {
        return Err("读取客户区失败".into());
    }
    if unsafe {
        DwmGetWindowAttribute(
            hwnd,
            DWMWA_EXTENDED_FRAME_BOUNDS as u32,
            &mut bounds as *mut _ as *mut _,
            std::mem::size_of::<RECT>() as u32,
        )
    } < 0
    {
        return Err("读取窗口边界失败".into());
    }
    let (ox, oy) = if frame.width() == client.right as u32 && frame.height() == client.bottom as u32
    {
        (0, 0)
    } else {
        if frame.width() != (bounds.right - bounds.left) as u32
            || frame.height() != (bounds.bottom - bounds.top) as u32
        {
            return Err("窗口尺寸正在变化，请重新截图".into());
        }
        (origin.x - bounds.left, origin.y - bounds.top)
    };
    if r.x < 0
        || r.y < 0
        || r.width == 0
        || r.height == 0
        || i64::from(r.x) + i64::from(r.width) > i64::from(client.right)
        || i64::from(r.y) + i64::from(r.height) > i64::from(client.bottom)
        || u64::from(r.width) * u64::from(r.height) > 16_000_000
    {
        return Err("截图区域超出客户区或过大".into());
    }
    let x = ox + r.x;
    let y = oy + r.y;
    if x < 0
        || y < 0
        || x as u64 + r.width as u64 > frame.width() as u64
        || y as u64 + r.height as u64 > frame.height() as u64
    {
        return Err("客户区与截图边界不匹配".into());
    }
    let mut buffer = frame
        .buffer_crop(x as u32, y as u32, x as u32 + r.width, y as u32 + r.height)
        .map_err(|e| e.to_string())?;
    // One row-by-row copy out of the mapped staging texture. The crate's unpadding helper
    // copies twice and starts a process-wide thread pool that never exits.
    let row = r.width as usize * 4;
    let pitch = buffer.row_pitch() as usize;
    let raw = buffer.as_raw_buffer();
    if pitch < row || raw.len() < pitch * (r.height as usize - 1) + row {
        return Err("截图像素长度错误".into());
    }
    let mut pixels = Vec::with_capacity(row * r.height as usize);
    for line in raw.chunks(pitch).take(r.height as usize) {
        pixels.extend_from_slice(&line[..row]);
    }
    RgbaImage::from_raw(r.width, r.height, pixels).ok_or_else(|| "截图像素长度错误".into())
}
impl GraphicsCaptureApiHandler for OneFrame {
    type Flags = Flags;
    type Error = String;
    fn new(context: Context<Flags>) -> Result<Self, String> {
        Ok(Self(context.flags))
    }
    fn on_frame_arrived(
        &mut self,
        frame: &mut Frame,
        control: InternalCaptureControl,
    ) -> Result<(), String> {
        let result = copy_frame(&self.0.window, self.0.region, frame);
        let _ = self.0.sender.try_send(result);
        control.stop();
        Ok(())
    }
    fn on_closed(&mut self) -> Result<(), String> {
        let _ = self.0.sender.try_send(Err("目标窗口已关闭".into()));
        Ok(())
    }
}

struct Request {
    region: Region,
    after: i64,
    sender: mpsc::SyncSender<Result<RgbaImage, String>>,
}
struct StreamFlags {
    window: BoundWindow,
    pending: Arc<Mutex<Option<Request>>>,
}
struct Stream(StreamFlags);
impl GraphicsCaptureApiHandler for Stream {
    type Flags = StreamFlags;
    type Error = String;
    fn new(context: Context<StreamFlags>) -> Result<Self, String> {
        Ok(Self(context.flags))
    }
    fn on_frame_arrived(
        &mut self,
        frame: &mut Frame,
        _: InternalCaptureControl,
    ) -> Result<(), String> {
        let mut pending = self.0.pending.lock().map_err(|_| "截图请求锁异常")?;
        let Some(request) = pending.as_ref() else {
            return Ok(());
        };
        let timestamp = frame.timestamp().map_err(|e| e.to_string())?.Duration;
        if timestamp < request.after {
            return Ok(());
        }
        let request = pending.take().expect("request checked");
        drop(pending);
        let _ = request
            .sender
            .try_send(copy_frame(&self.0.window, request.region, frame));
        Ok(())
    }
    fn on_closed(&mut self) -> Result<(), String> {
        if let Ok(mut pending) = self.0.pending.lock() {
            if let Some(request) = pending.take() {
                let _ = request.sender.try_send(Err("目标窗口已关闭".into()));
            }
        }
        Ok(())
    }
}
fn capture_clock() -> Result<i64, String> {
    let mut ticks = 0i64;
    let mut frequency = 0i64;
    if unsafe { QueryPerformanceCounter(&mut ticks) } == 0
        || unsafe { QueryPerformanceFrequency(&mut frequency) } == 0
        || frequency <= 0
    {
        return Err("读取截图时间失败".into());
    }
    i64::try_from(i128::from(ticks) * 10_000_000 / i128::from(frequency))
        .map_err(|_| "截图时间超出范围".into())
}
pub(crate) struct WindowCapture {
    window: BoundWindow,
    pending: Arc<Mutex<Option<Request>>>,
    control: Option<CaptureControl<Stream, String>>,
}
impl WindowCapture {
    pub fn start(window: &BoundWindow) -> Result<Self, String> {
        let pending = Arc::new(Mutex::new(None));
        let settings = Settings::new(
            Window::from_raw_hwnd(window.hwnd as HWND),
            CursorCaptureSettings::WithoutCursor,
            DrawBorderSettings::Default,
            SecondaryWindowSettings::Default,
            MinimumUpdateIntervalSettings::Default,
            DirtyRegionSettings::Default,
            ColorFormat::Rgba8,
            StreamFlags {
                window: window.clone(),
                pending: pending.clone(),
            },
        );
        let control = Stream::start_free_threaded(settings)
            .map_err(|e| format!("无法启动WGC窗口截图：{e}"))?;
        Ok(Self {
            window: window.clone(),
            pending,
            control: Some(control),
        })
    }
    pub fn matches(&self, window: &BoundWindow) -> bool {
        self.window.hwnd == window.hwnd
            && self.window.pid == window.pid
            && self
                .control
                .as_ref()
                .is_some_and(|control| !control.is_finished())
    }
    pub fn capture(&mut self, region: Region, cancel: &Cancellation) -> Result<RgbaImage, String> {
        crate::native::validate_window(&self.window)?;
        if cancel.is_cancelled() {
            return Err("已停止".into());
        }
        if unsafe { IsIconic(self.window.hwnd as HWND) } != 0 {
            return Err("目标窗口已最小化，请还原后截图；无需切到前台".into());
        }
        let (tx, rx) = mpsc::sync_channel(1);
        let after = capture_clock()?;
        *self.pending.lock().map_err(|_| "截图请求锁异常")? = Some(Request {
            region,
            after,
            sender: tx,
        });
        let started = Instant::now();
        let result = loop {
            if cancel.is_cancelled() {
                break Err("已停止".into());
            }
            match rx.recv_timeout(Duration::from_millis(20)) {
                Ok(result) => break result,
                Err(mpsc::RecvTimeoutError::Disconnected) => break Err("截图会话提前结束".into()),
                Err(mpsc::RecvTimeoutError::Timeout) => {}
            }
            if self
                .control
                .as_ref()
                .is_none_or(|control| control.is_finished())
            {
                break Err("截图会话提前结束".into());
            }
            if started.elapsed() >= Duration::from_millis(250) {
                // Static windows may not produce another frame. A separate one-frame
                // capture preserves fresh-image semantics while this session stays alive.
                if let Ok(mut pending) = self.pending.lock() {
                    pending.take();
                }
                break capture(&self.window, region, cancel);
            }
        };
        if let Ok(mut pending) = self.pending.lock() {
            pending.take();
        }
        result
    }
}
impl Drop for WindowCapture {
    fn drop(&mut self) {
        if let Some(control) = self.control.take() {
            let _ = control.stop();
        }
    }
}
pub fn capture(
    window: &BoundWindow,
    region: Region,
    cancel: &Cancellation,
) -> Result<RgbaImage, String> {
    if cancel.is_cancelled() {
        return Err("已停止".into());
    }
    if unsafe { IsIconic(window.hwnd as HWND) } != 0 {
        return Err("目标窗口已最小化，请还原后截图；无需切到前台".into());
    }
    let (tx, rx) = mpsc::sync_channel(1);
    let settings = Settings::new(
        Window::from_raw_hwnd(window.hwnd as HWND),
        CursorCaptureSettings::WithoutCursor,
        DrawBorderSettings::Default,
        SecondaryWindowSettings::Default,
        MinimumUpdateIntervalSettings::Default,
        DirtyRegionSettings::Default,
        ColorFormat::Rgba8,
        Flags {
            window: window.clone(),
            region,
            sender: tx,
        },
    );
    let control =
        OneFrame::start_free_threaded(settings).map_err(|e| format!("无法启动WGC窗口截图：{e}"))?;
    let started = Instant::now();
    let result = loop {
        if cancel.is_cancelled() {
            break Err("已停止".into());
        }
        match rx.recv_timeout(Duration::from_millis(20)) {
            Ok(result) => break result,
            Err(mpsc::RecvTimeoutError::Disconnected) => break Err("截图会话提前结束".into()),
            Err(mpsc::RecvTimeoutError::Timeout) => {}
        }
        if control.is_finished() {
            break Err("未收到窗口新帧".into());
        }
        if started.elapsed() > Duration::from_secs(5) {
            break Err("等待窗口新帧超时，请确认窗口未最小化且允许截图".into());
        }
    };
    let stopped = control
        .stop()
        .map_err(|e| format!("回收WGC截图会话失败：{e}"));
    match result {
        Ok(frame) => {
            stopped?;
            Ok(frame)
        }
        Err(error) => Err(error),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{ptr::null_mut, sync::mpsc, thread};
    use windows_sys::Win32::Graphics::Gdi::UpdateWindow;
    use windows_sys::Win32::System::Threading::{GetCurrentProcessId, GetCurrentThreadId};

    #[test]
    #[ignore = "creates a local non-activating WGC fixture window"]
    fn persistent_capture_reads_changed_and_static_window_and_stops() {
        let (tx, rx) = mpsc::channel();
        let ui = thread::spawn(move || unsafe {
            let class: Vec<u16> = "STATIC\0".encode_utf16().collect();
            let title: Vec<u16> = "FIRST 12345\0".encode_utf16().collect();
            let hwnd = CreateWindowExW(
                WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE,
                class.as_ptr(),
                title.as_ptr(),
                WS_OVERLAPPEDWINDOW,
                100,
                100,
                360,
                180,
                null_mut(),
                null_mut(),
                null_mut(),
                null_mut(),
            );
            assert!(!hwnd.is_null());
            ShowWindow(hwnd, SW_SHOWNOACTIVATE);
            UpdateWindow(hwnd);
            let mut rect: RECT = std::mem::zeroed();
            assert_ne!(GetClientRect(hwnd, &mut rect), 0);
            tx.send((
                BoundWindow {
                    hwnd: hwnd as u64,
                    pid: GetCurrentProcessId(),
                    title: "WGC fixture".into(),
                    width: rect.right,
                    height: rect.bottom,
                },
                GetCurrentThreadId(),
            ))
            .unwrap();
            let mut message: MSG = std::mem::zeroed();
            while GetMessageW(&mut message, null_mut(), 0, 0) > 0 {
                TranslateMessage(&message);
                DispatchMessageW(&message);
            }
            DestroyWindow(hwnd);
        });
        let (window, thread_id) = rx.recv_timeout(Duration::from_secs(3)).unwrap();
        let region = Region {
            x: 0,
            y: 0,
            width: window.width as u32,
            height: window.height as u32,
        };
        let cancel = Cancellation::default();
        let mut session = WindowCapture::start(&window).unwrap();
        let first = session.capture(region, &cancel).unwrap();
        assert!(session.matches(&window));
        let same = session.capture(region, &cancel).unwrap();
        assert_eq!(first, same);
        let replacement: Vec<u16> = "SECOND 98765\0".encode_utf16().collect();
        unsafe {
            assert_ne!(SetWindowTextW(window.hwnd as HWND, replacement.as_ptr()), 0);
            UpdateWindow(window.hwnd as HWND);
        }
        let changed = session.capture(region, &cancel).unwrap();
        assert_ne!(first, changed);
        assert!(session.matches(&window));
        cancel.cancel();
        assert!(session
            .capture(region, &cancel)
            .unwrap_err()
            .contains("停止"));
        drop(session);
        assert_ne!(unsafe { PostThreadMessageW(thread_id, WM_QUIT, 0, 0) }, 0);
        ui.join().unwrap();
    }
}
