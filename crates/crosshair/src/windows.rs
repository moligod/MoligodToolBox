use crate::keyboard::{key_event, Keyboard};
use crate::{render, Monitor, Status};
use moligod_core::config::Crosshair;
use moligod_core::hotkey::KeyTransition;
use std::{
    mem::size_of,
    path::PathBuf,
    ptr::{null, null_mut},
    sync::{mpsc, Arc, Mutex, OnceLock},
    thread::{self, JoinHandle},
    time::Duration,
};
use windows_sys::Win32::{
    Foundation::*,
    Graphics::Gdi::*,
    System::LibraryLoader::GetModuleHandleW,
    UI::{HiDpi::*, WindowsAndMessaging::*},
};

const WAKE: u32 = WM_APP + 10;
const DISPLAY_CHANGED: u32 = WM_APP + 11;
const CLASS: &[u16] = &[
    109, 111, 108, 105, 103, 111, 100, 46, 99, 114, 111, 115, 115, 104, 97, 105, 114, 0,
];
type Reply = mpsc::Sender<Result<Status, String>>;
type Observer = Arc<dyn Fn(Status) + Send + Sync>;

enum Command {
    Apply(Crosshair, Reply),
    Show(bool, Reply),
    Stop(Reply),
    Capture(bool, Reply),
}
struct Worker {
    hwnd: usize,
    commands: mpsc::Sender<Command>,
    join: JoinHandle<()>,
}

pub struct Overlay {
    directory: PathBuf,
    worker: Option<Worker>,
    status: Arc<Mutex<Status>>,
    observer: Observer,
}

impl Overlay {
    pub fn capture(&self, capturing: bool) -> Result<Status, String> {
        if self.worker.is_none() {
            return Ok(self.status());
        }
        self.request(|reply| Command::Capture(capturing, reply))
    }
    pub fn new(directory: PathBuf, observer: impl Fn(Status) + Send + Sync + 'static) -> Self {
        Self {
            directory,
            worker: None,
            status: Arc::default(),
            observer: Arc::new(observer),
        }
    }
    pub fn status(&self) -> Status {
        self.status
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone()
    }
    pub fn window_handle(&self) -> Option<usize> {
        self.worker.as_ref().map(|w| w.hwnd)
    }
    pub fn start(&mut self, config: Crosshair) -> Result<Status, String> {
        config.validate()?;
        if self.worker.as_ref().is_some_and(|w| w.join.is_finished()) {
            if let Some(worker) = self.worker.take() {
                let _ = worker.join.join();
            }
        }
        if self.worker.is_some() {
            let visible = KeyTransition::default().reconfigure(
                config.hotkey_mode,
                config.hotkey.is_some(),
                true,
            );
            self.apply(config)?;
            return self.show(visible);
        }
        let (commands, receiver) = mpsc::channel();
        let (ready, started) = mpsc::channel();
        let (accept, accepted) = mpsc::channel();
        let directory = self.directory.clone();
        let status = self.status.clone();
        let observer = self.observer.clone();
        let join = thread::Builder::new()
            .name("moligod-crosshair".into())
            .spawn(move || {
                let result = run(
                    config, directory, receiver, &ready, &accepted, &status, &observer,
                );
                let final_status = Status {
                    error: result.as_ref().err().cloned(),
                    ..Status::default()
                };
                publish(&status, &observer, final_status);
                if let Err(error) = result {
                    let _ = ready.send(Err(error));
                }
            })
            .map_err(|e| e.to_string())?;
        match started.recv_timeout(Duration::from_secs(10)) {
            Ok(Ok(hwnd)) => {
                accept.send(()).map_err(|_| "准星线程已退出")?;
                self.worker = Some(Worker {
                    hwnd,
                    commands,
                    join,
                });
                Ok(self.status())
            }
            Ok(Err(error)) => {
                let _ = join.join();
                Err(error)
            }
            Err(_) => {
                // Dropping the receiver makes a late startup abort before entering GetMessage.
                Err("准星启动超时，未完成的窗口会自动释放".into())
            }
        }
    }
    fn request(&self, command: impl FnOnce(Reply) -> Command) -> Result<Status, String> {
        let worker = self.worker.as_ref().ok_or("准星未启动")?;
        let (send, receive) = mpsc::channel();
        worker
            .commands
            .send(command(send))
            .map_err(|_| "准星线程已退出")?;
        // SAFETY: hwnd belongs to the live worker; PostMessage is cross-thread by design.
        if unsafe { PostMessageW(worker.hwnd as HWND, WAKE, 0, 0) } == 0 {
            return Err(last_error("唤醒准星线程失败"));
        }
        receive
            .recv_timeout(Duration::from_secs(10))
            .map_err(|_| "准星操作超时，请关闭工具后重试".to_string())?
    }
    pub fn apply(&mut self, config: Crosshair) -> Result<Status, String> {
        config.validate()?;
        self.request(|reply| Command::Apply(config, reply))
    }
    pub fn show(&self, visible: bool) -> Result<Status, String> {
        self.request(|reply| Command::Show(visible, reply))
    }
    pub fn stop(&mut self) -> Result<Status, String> {
        if let Some(worker) = &self.worker {
            if !worker.join.is_finished() {
                self.request(Command::Stop)?;
            }
        }
        if let Some(worker) = self.worker.take() {
            worker.join.join().map_err(|_| "准星线程异常退出")?;
        }
        Ok(self.status())
    }
}
impl Drop for Overlay {
    fn drop(&mut self) {
        let _ = self.stop();
    }
}

fn publish(shared: &Mutex<Status>, observer: &Observer, status: Status) {
    *shared.lock().unwrap_or_else(|e| e.into_inner()) = status.clone();
    observer(status);
}
fn last_error(context: &str) -> String {
    format!("{context}：{}", std::io::Error::last_os_error())
}

unsafe extern "system" fn window_proc(hwnd: HWND, message: u32, w: WPARAM, l: LPARAM) -> LRESULT {
    // SAFETY: Win32 owns callback arguments; no heap pointers are read in the callback.
    unsafe {
        match message {
            WM_NCHITTEST => HTTRANSPARENT as LRESULT,
            WM_MOUSEACTIVATE => MA_NOACTIVATE as LRESULT,
            WM_DISPLAYCHANGE | WM_DPICHANGED => {
                PostMessageW(hwnd, DISPLAY_CHANGED, 0, 0);
                0
            }
            WM_CLOSE => {
                PostQuitMessage(0);
                0
            }
            _ => DefWindowProcW(hwnd, message, w, l),
        }
    }
}

struct NativeWindow(HWND);
impl Drop for NativeWindow {
    fn drop(&mut self) {
        unsafe {
            DestroyWindow(self.0);
        }
    }
}
fn create_window() -> Result<NativeWindow, String> {
    static REGISTERED: OnceLock<Result<(), String>> = OnceLock::new();
    REGISTERED
        .get_or_init(|| {
            let class = WNDCLASSW {
                lpfnWndProc: Some(window_proc),
                hInstance: unsafe { GetModuleHandleW(null()) },
                lpszClassName: CLASS.as_ptr(),
                ..unsafe { std::mem::zeroed() }
            };
            if unsafe { RegisterClassW(&class) } == 0 {
                Err(last_error("注册准星窗口失败"))
            } else {
                Ok(())
            }
        })
        .clone()?;
    let title: Vec<u16> = "moligod crosshair\0".encode_utf16().collect();
    let hwnd = unsafe {
        CreateWindowExW(
            WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE | WS_EX_TOPMOST,
            CLASS.as_ptr(),
            title.as_ptr(),
            WS_POPUP,
            0,
            0,
            1,
            1,
            null_mut(),
            null_mut(),
            GetModuleHandleW(null()),
            null(),
        )
    };
    if hwnd.is_null() {
        return Err(last_error("创建准星窗口失败"));
    }
    Ok(NativeWindow(hwnd))
}

fn run(
    mut config: Crosshair,
    directory: PathBuf,
    receiver: mpsc::Receiver<Command>,
    ready: &mpsc::Sender<Result<usize, String>>,
    accepted: &mpsc::Receiver<()>,
    shared: &Mutex<Status>,
    observer: &Observer,
) -> Result<(), String> {
    // Isolated thread uses physical screen pixels. No change to the Tauri UI's DPI context.
    unsafe {
        SetThreadDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
    }
    let window = create_window()?;
    let hwnd = window.0;
    let mut keyboard = if config.hotkey.is_some() {
        Some(Keyboard::new(
            hwnd,
            config.hotkey.is_some_and(|key| key < 8),
        )?)
    } else {
        None
    };
    let mut trigger = KeyTransition::default();
    let visible = trigger.reconfigure(config.hotkey_mode, config.hotkey.is_some(), true);
    let mut capturing = false;
    draw(hwnd, &config, &directory)?;
    unsafe {
        ShowWindow(hwnd, if visible { SW_SHOWNOACTIVATE } else { SW_HIDE });
    }
    let mut state = Status {
        running: true,
        visible,
        draw_count: 1,
        error: None,
    };
    publish(shared, observer, state.clone());
    if ready.send(Ok(hwnd as usize)).is_err() {
        return Ok(());
    }
    // The owner must acknowledge startup; a timeout can never orphan a message loop.
    if accepted.recv_timeout(Duration::from_secs(10)).is_err() {
        return Ok(());
    }
    let mut stop_reply = None;
    'messages: loop {
        let mut message: MSG = unsafe { std::mem::zeroed() };
        let result = unsafe { GetMessageW(&mut message, null_mut(), 0, 0) };
        if result == -1 {
            return Err(last_error("准星消息循环失败"));
        }
        if result == 0 {
            break;
        }
        if message.message == WAKE {
            while let Ok(command) = receiver.try_recv() {
                match command {
                    Command::Capture(value, reply) => {
                        capturing = value;
                        state.visible = trigger.reset(state.visible);
                        unsafe {
                            ShowWindow(
                                hwnd,
                                if state.visible {
                                    SW_SHOWNOACTIVATE
                                } else {
                                    SW_HIDE
                                },
                            );
                        }
                        publish(shared, observer, state.clone());
                        let _ = reply.send(Ok(state.clone()));
                    }
                    Command::Stop(reply) => {
                        stop_reply = Some(reply);
                        break 'messages;
                    }
                    Command::Show(visible, reply) => {
                        trigger.reset(visible);
                        unsafe {
                            ShowWindow(hwnd, if visible { SW_SHOWNOACTIVATE } else { SW_HIDE });
                        }
                        state.visible = visible;
                        publish(shared, observer, state.clone());
                        let _ = reply.send(Ok(state.clone()));
                    }
                    Command::Apply(next, reply) => {
                        let result: Result<Status, String> = (|| {
                            next.validate()?;
                            let replacement = if next.hotkey.is_some()
                                && (keyboard.is_none()
                                    || next.hotkey.is_some_and(|key| key < 8)
                                        != config.hotkey.is_some_and(|key| key < 8))
                            {
                                Some(Keyboard::new(hwnd, next.hotkey.is_some_and(|key| key < 8))?)
                            } else {
                                None
                            };
                            if next != config {
                                draw(hwnd, &next, &directory)?;
                                state.draw_count += 1;
                            }
                            if let Some(replacement) = replacement {
                                keyboard = Some(replacement);
                            }
                            if next.hotkey != config.hotkey
                                || next.hotkey_mode != config.hotkey_mode
                            {
                                state.visible = trigger.reconfigure(
                                    next.hotkey_mode,
                                    next.hotkey.is_some(),
                                    state.visible,
                                );
                                unsafe {
                                    ShowWindow(
                                        hwnd,
                                        if state.visible {
                                            SW_SHOWNOACTIVATE
                                        } else {
                                            SW_HIDE
                                        },
                                    );
                                }
                            }
                            if next.hotkey.is_none() {
                                keyboard = None;
                            }
                            config = next;
                            state.error = None;
                            Ok(state.clone())
                        })();
                        if let Err(error) = &result {
                            state.error = Some(error.clone());
                        }
                        publish(shared, observer, state.clone());
                        let _ = reply.send(result);
                    }
                }
            }
        } else if message.message == WM_INPUT {
            if !capturing {
                if let Some((vk, down)) = key_event(message.lParam, config.hotkey) {
                    if config.hotkey == Some(vk) {
                        if let Some(visible) =
                            trigger.input(down, config.hotkey_mode, state.visible)
                        {
                            state.visible = visible;
                            unsafe {
                                ShowWindow(hwnd, if visible { SW_SHOWNOACTIVATE } else { SW_HIDE });
                            }
                            publish(shared, observer, state.clone());
                        }
                    }
                }
            }
            unsafe {
                DefWindowProcW(hwnd, message.message, message.wParam, message.lParam);
            }
        } else if message.message == DISPLAY_CHANGED {
            match draw(hwnd, &config, &directory) {
                Ok(()) => {
                    state.draw_count += 1;
                    state.error = None;
                }
                Err(error) => state.error = Some(error),
            }
            publish(shared, observer, state.clone());
        } else {
            unsafe {
                TranslateMessage(&message);
                DispatchMessageW(&message);
            }
        }
    }
    drop(keyboard);
    drop(window);
    let stopped = Status::default();
    publish(shared, observer, stopped.clone());
    if let Some(reply) = stop_reply {
        let _ = reply.send(Ok(stopped));
    }
    Ok(())
}

struct Surface {
    dc: HDC,
    bitmap: HBITMAP,
    previous: HGDIOBJ,
}
impl Drop for Surface {
    fn drop(&mut self) {
        unsafe {
            if !self.previous.is_null() {
                SelectObject(self.dc, self.previous);
            }
            if !self.bitmap.is_null() {
                DeleteObject(self.bitmap);
            }
            if !self.dc.is_null() {
                DeleteDC(self.dc);
            }
        }
    }
}

fn draw(hwnd: HWND, config: &Crosshair, directory: &std::path::Path) -> Result<(), String> {
    let image = render::raster(config, directory)?;
    let (width, height) = image.dimensions();
    let displays = monitors()?;
    let screen = displays
        .iter()
        .find(|m| m.id == config.monitor)
        .or_else(|| displays.iter().find(|m| m.primary))
        .or(displays.first())
        .ok_or("未找到显示器")?;
    let cx = (screen.x + screen.width / 2 + config.offset_x)
        .clamp(screen.x, screen.x + screen.width - 1);
    let cy = (screen.y + screen.height / 2 + config.offset_y)
        .clamp(screen.y, screen.y + screen.height - 1);
    let position = POINT {
        x: cx - width as i32 / 2,
        y: cy - height as i32 / 2,
    };
    let size = SIZE {
        cx: width as i32,
        cy: height as i32,
    };
    let source = POINT { x: 0, y: 0 };
    let blend = BLENDFUNCTION {
        BlendOp: AC_SRC_OVER as u8,
        BlendFlags: 0,
        SourceConstantAlpha: 255,
        AlphaFormat: AC_SRC_ALPHA as u8,
    };
    // All GDI resources are short-lived and released even when UpdateLayeredWindow fails.
    unsafe {
        let mut surface = Surface {
            dc: CreateCompatibleDC(null_mut()),
            bitmap: null_mut(),
            previous: null_mut(),
        };
        if surface.dc.is_null() {
            return Err(last_error("创建准星绘图上下文失败"));
        }
        let info = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width as i32,
                biHeight: -(height as i32),
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB,
                ..std::mem::zeroed()
            },
            ..std::mem::zeroed()
        };
        let mut bits = null_mut();
        surface.bitmap =
            CreateDIBSection(surface.dc, &info, DIB_RGB_COLORS, &mut bits, null_mut(), 0);
        if surface.bitmap.is_null() || bits.is_null() {
            return Err(last_error("创建准星位图失败"));
        }
        surface.previous = SelectObject(surface.dc, surface.bitmap);
        if surface.previous.is_null() || surface.previous as isize == -1 {
            surface.previous = null_mut();
            return Err(last_error("选入准星位图失败"));
        }
        let bytes = render::bgra(&image);
        std::ptr::copy_nonoverlapping(bytes.as_ptr(), bits.cast::<u8>(), bytes.len());
        if UpdateLayeredWindow(
            hwnd,
            null_mut(),
            &position,
            &size,
            surface.dc,
            &source,
            0,
            &blend,
            ULW_ALPHA,
        ) == 0
        {
            return Err(last_error("绘制准星失败"));
        }
        if SetWindowPos(
            hwnd,
            HWND_TOPMOST,
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
        ) == 0
        {
            return Err(last_error("准星置顶失败"));
        }
    }
    Ok(())
}

pub fn monitors() -> Result<Vec<Monitor>, String> {
    unsafe extern "system" fn collect(
        monitor: HMONITOR,
        _: HDC,
        _: *mut RECT,
        data: LPARAM,
    ) -> i32 {
        let mut info: MONITORINFOEXW = unsafe { std::mem::zeroed() };
        info.monitorInfo.cbSize = size_of::<MONITORINFOEXW>() as u32;
        if unsafe { GetMonitorInfoW(monitor, (&mut info as *mut MONITORINFOEXW).cast()) } != 0 {
            let end = info
                .szDevice
                .iter()
                .position(|c| *c == 0)
                .unwrap_or(info.szDevice.len());
            let rect = info.monitorInfo.rcMonitor;
            let entry = Monitor {
                id: String::from_utf16_lossy(&info.szDevice[..end]),
                primary: info.monitorInfo.dwFlags & 1 != 0,
                x: rect.left,
                y: rect.top,
                width: rect.right - rect.left,
                height: rect.bottom - rect.top,
            };
            // SAFETY: EnumDisplayMonitors is synchronous; the pointer owns a live Vec below.
            unsafe {
                (&mut *(data as *mut Vec<Monitor>)).push(entry);
            }
        }
        1
    }
    let mut output: Vec<Monitor> = Vec::new();
    let previous =
        unsafe { SetThreadDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2) };
    let success = unsafe {
        EnumDisplayMonitors(
            null_mut(),
            null(),
            Some(collect),
            (&mut output as *mut Vec<Monitor>) as LPARAM,
        )
    };
    if !previous.is_null() {
        unsafe {
            SetThreadDpiAwarenessContext(previous);
        }
    }
    if success == 0 {
        Err(last_error("读取显示器失败"))
    } else {
        Ok(output)
    }
}
