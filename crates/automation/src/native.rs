pub use crate::ocr::ManualOcr;
use crate::{
    engine::{Driver, Plan},
    model::*,
};
use image::{ImageReader, RgbaImage};
use moligod_core::task::{Cancellation, TaskSlot};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    io::{Cursor, Read, Write},
    mem::size_of,
    path::{Path, PathBuf},
    ptr::null_mut,
    sync::{mpsc, Arc, Mutex},
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use windows::Win32::System::WinRT::{RoInitialize, RoUninitialize, RO_INIT_MULTITHREADED};
use windows_sys::Win32::{
    Foundation::*,
    Graphics::Gdi::*,
    System::{
        SystemInformation::GetLocalTime, Threading::GetCurrentThreadId, Time::SystemTimeToFileTime,
    },
    UI::{HiDpi::*, Input::KeyboardAndMouse::*, WindowsAndMessaging::*},
};

pub fn windows() -> Result<Vec<BoundWindow>, String> {
    unsafe extern "system" fn collect(hwnd: HWND, data: LPARAM) -> i32 {
        unsafe {
            if IsWindowVisible(hwnd) == 0 || !GetWindow(hwnd, GW_OWNER).is_null() {
                return 1;
            }
            let mut title = [0u16; 512];
            let len = GetWindowTextW(hwnd, title.as_mut_ptr(), title.len() as i32);
            if len <= 0 {
                return 1;
            }
            let mut rect: RECT = std::mem::zeroed();
            if GetClientRect(hwnd, &mut rect) == 0 || rect.right <= 0 || rect.bottom <= 0 {
                return 1;
            }
            let mut pid = 0;
            GetWindowThreadProcessId(hwnd, &mut pid);
            let out = &mut *(data as *mut Vec<BoundWindow>);
            if out.len() < 200 {
                out.push(BoundWindow {
                    hwnd: hwnd as u64,
                    pid,
                    title: String::from_utf16_lossy(&title[..len as usize]),
                    width: rect.right,
                    height: rect.bottom,
                });
            }
            1
        }
    }
    let mut output = Vec::new();
    let previous =
        unsafe { SetThreadDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2) };
    let result = unsafe {
        EnumWindows(
            Some(collect),
            (&mut output as *mut Vec<BoundWindow>) as LPARAM,
        )
    };
    if !previous.is_null() {
        unsafe {
            SetThreadDpiAwarenessContext(previous);
        }
    }
    if result == 0 {
        return Err(std::io::Error::last_os_error().to_string());
    }
    Ok(output)
}
pub(crate) fn target(window: &BoundWindow) -> Result<HWND, String> {
    let hwnd = window.hwnd as HWND;
    let mut pid = 0;
    unsafe {
        GetWindowThreadProcessId(hwnd, &mut pid);
    }
    if unsafe { IsWindow(hwnd) } == 0 || pid != window.pid {
        return Err("绑定窗口已关闭或发生变化，请重新绑定".into());
    }
    Ok(hwnd)
}
pub fn validate_window(window: &BoundWindow) -> Result<(), String> {
    target(window).map(|_| ())
}
/// Convert a physical desktop point into the bound window's client coordinates.
pub fn client_point(window: &BoundWindow, mut point: POINT) -> Result<(i32, i32), String> {
    let hwnd = target(window)?;
    let mut rect: RECT = unsafe { std::mem::zeroed() };
    if unsafe { ScreenToClient(hwnd, &mut point) } == 0
        || unsafe { GetClientRect(hwnd, &mut rect) } == 0
    {
        return Err("无法读取目标窗口坐标".into());
    }
    if point.x < 0 || point.y < 0 || point.x >= rect.right || point.y >= rect.bottom {
        return Err("请在绑定窗口的内容区域内松开鼠标".into());
    }
    Ok((point.x, point.y))
}

/// Only polls during an explicit drag, on the module command thread, for at most 15s.
pub fn pick_point(window: &BoundWindow) -> Result<Value, String> {
    let hwnd = target(window)?;
    let previous =
        unsafe { SetThreadDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2) };
    let result = (|| {
        if unsafe { GetAsyncKeyState(VK_LBUTTON as i32) } >= 0 {
            return Err("请按住取坐标按钮，再拖到目标窗口松开".into());
        }
        let started = Instant::now();
        loop {
            if unsafe { GetAsyncKeyState(VK_ESCAPE as i32) } < 0 {
                return Err("已取消取坐标".into());
            }
            if started.elapsed() >= Duration::from_secs(15) {
                return Err("取坐标超时，请重新按住按钮拖动".into());
            }
            target(window)?;
            if unsafe { GetAsyncKeyState(VK_LBUTTON as i32) } >= 0 {
                let mut point = POINT { x: 0, y: 0 };
                if unsafe { GetCursorPos(&mut point) } == 0 {
                    return Err("无法读取鼠标位置".into());
                }
                let under = unsafe { GetAncestor(WindowFromPoint(point), GA_ROOT) };
                if under != hwnd {
                    return Err("请拖到绑定的目标窗口内松开鼠标".into());
                }
                let (x, y) = client_point(window, point)?;
                return Ok(json!({"x":x,"y":y}));
            }
            thread::sleep(Duration::from_millis(8));
        }
    })();
    if !previous.is_null() {
        unsafe {
            SetThreadDpiAwarenessContext(previous);
        }
    }
    result
}

fn focus(window: &BoundWindow, cancel: &Cancellation) -> Result<HWND, String> {
    if cancel.is_cancelled() {
        return Err("已停止".into());
    }
    let hwnd = target(window)?;
    unsafe {
        if IsIconic(hwnd) != 0 {
            ShowWindow(hwnd, SW_RESTORE);
        }
        if GetForegroundWindow() != hwnd {
            SetForegroundWindow(hwnd);
        }
    }
    let started = Instant::now();
    loop {
        if cancel.is_cancelled() {
            return Err("已停止".into());
        }
        target(window)?;
        if unsafe { GetForegroundWindow() } == hwnd {
            return Ok(hwnd);
        }
        if started.elapsed() >= Duration::from_secs(1) {
            return Err("窗口切换失败：目标窗口未进入前台，请检查窗口状态或手动切到目标窗口后重试；已停止输入".into());
        }
        if cancel.wait(Duration::from_millis(20)) {
            return Err("已停止".into());
        }
    }
}
pub fn full_client_region(window: &BoundWindow) -> Result<Region, String> {
    let hwnd = target(window)?;
    unsafe {
        let previous = SetThreadDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
        let mut rect: RECT = std::mem::zeroed();
        let ok = GetClientRect(hwnd, &mut rect);
        if !previous.is_null() {
            SetThreadDpiAwarenessContext(previous);
        }
        if ok == 0 || rect.right <= 0 || rect.bottom <= 0 {
            return Err("无法读取目标窗口当前尺寸".into());
        }
        Ok(Region {
            x: 0,
            y: 0,
            width: rect.right as u32,
            height: rect.bottom as u32,
        })
    }
}
pub fn window_scale(window: &BoundWindow) -> Result<u32, String> {
    let hwnd = target(window)?;
    let dpi = unsafe {
        let previous = SetThreadDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
        let mut dpi = 0;
        let mut dpi_y = 0;
        if GetDpiForMonitor(
            MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST),
            MDT_EFFECTIVE_DPI,
            &mut dpi,
            &mut dpi_y,
        ) < 0
        {
            dpi = 0;
        }
        if !previous.is_null() {
            SetThreadDpiAwarenessContext(previous);
        }
        dpi
    };
    if dpi == 0 {
        return Err("无法读取目标窗口缩放".into());
    }
    Ok((dpi * 100 + 48) / 96)
}
pub fn capture(
    window: &BoundWindow,
    region: Region,
    cancel: &Cancellation,
) -> Result<RgbaImage, String> {
    target(window)?;
    crate::window_capture::capture(window, region, cancel)
}
fn send(input: INPUT) -> Result<(), String> {
    if unsafe { SendInput(1, &input, size_of::<INPUT>() as i32) } == 1 {
        Ok(())
    } else {
        Err("系统拒绝输入，请确认目标权限和窗口状态".into())
    }
}
fn key_input(key: u16, up: bool, unicode: bool) -> INPUT {
    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: if unicode { 0 } else { key },
                wScan: if unicode { key } else { 0 },
                dwFlags: (if up { KEYEVENTF_KEYUP } else { 0 })
                    | (if unicode { KEYEVENTF_UNICODE } else { 0 }),
                time: 0,
                dwExtraInfo: 0,
            },
        },
    }
}
fn mouse_input(flags: u32) -> INPUT {
    INPUT {
        r#type: INPUT_MOUSE,
        Anonymous: INPUT_0 {
            mi: MOUSEINPUT {
                dx: 0,
                dy: 0,
                mouseData: 0,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    }
}
fn wheel_input(delta: i32) -> INPUT {
    let mut input = mouse_input(MOUSEEVENTF_WHEEL);
    input.Anonymous.mi.mouseData = delta as u32;
    input
}
enum Release {
    Key(u16, bool),
    Mouse(u32),
}
struct Held(Vec<Release>);
impl Drop for Held {
    fn drop(&mut self) {
        for release in self.0.iter().rev() {
            let _ = match release {
                Release::Key(key, unicode) => send(key_input(*key, true, *unicode)),
                Release::Mouse(flags) => send(mouse_input(*flags)),
            };
        }
    }
}

pub struct NativeDriver {
    held_keys: crate::held_keys::HeldKeys,
    directory: PathBuf,
    scale: Option<u32>,
    expected_window: Option<(u64, u32)>,
    ocr: Option<crate::ocr::OcrWorker>,
    ocr_settings: Result<crate::ocr_settings::OcrSettings, String>,
    cache: BTreeMap<String, (Vec<u8>, String)>,
    capture: Option<crate::window_capture::WindowCapture>,
}
/// WGC/WinRT factory caches outlive individual requests. Keep the module's MTA alive
/// until all workers and cached objects have been released. This guard is thread-bound.
pub struct WinRtApartment(std::marker::PhantomData<std::rc::Rc<()>>);
impl WinRtApartment {
    pub fn new() -> Result<Self, String> {
        unsafe {
            RoInitialize(RO_INIT_MULTITHREADED).map_err(|e| e.to_string())?;
        }
        Ok(Self(std::marker::PhantomData))
    }
}
impl Drop for WinRtApartment {
    fn drop(&mut self) {
        unsafe {
            RoUninitialize();
        }
    }
}
impl NativeDriver {
    pub fn new(directory: PathBuf) -> Result<Self, String> {
        unsafe {
            SetThreadDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
            RoInitialize(RO_INIT_MULTITHREADED).map_err(|e| e.to_string())?;
        }
        let ocr_settings = crate::ocr_settings::load(&directory);
        Ok(Self {
            held_keys: crate::held_keys::HeldKeys::new(|key, up| send(key_input(key, up, false))),
            directory,
            ocr_settings,
            scale: None,
            expected_window: None,
            ocr: None,
            cache: BTreeMap::new(),
            capture: None,
        })
    }
    pub fn recognize(
        &mut self,
        image: &RgbaImage,
        cancel: &Cancellation,
    ) -> Result<String, String> {
        let settings = self.ocr_settings.clone()?;
        if self.ocr.as_ref().is_some_and(|worker| {
            worker.model() != settings.model || worker.device() != settings.device
        }) {
            self.ocr.take();
        }
        if self.ocr.is_none() {
            self.ocr = Some(crate::ocr::OcrWorker::start(
                settings.model,
                settings.device,
                cancel,
            )?);
        }
        let result = self
            .ocr
            .as_mut()
            .ok_or("OCR 尚未就绪")?
            .recognize(image, cancel);
        if result.is_err() {
            self.ocr.take();
        }
        result
    }
    fn capture_frame(
        &mut self,
        window: &BoundWindow,
        region: Region,
        cancel: &Cancellation,
    ) -> Result<RgbaImage, String> {
        if cancel.is_cancelled() {
            return Err("已停止".into());
        }
        validate_window(window)?;
        if unsafe { IsIconic(window.hwnd as HWND) } != 0 {
            return Err("目标窗口已最小化，请还原后截图；无需切到前台".into());
        }
        if self
            .capture
            .as_ref()
            .is_none_or(|session| !session.matches(window))
        {
            self.capture.take();
            self.capture = Some(crate::window_capture::WindowCapture::start(window)?);
        }
        let result = self
            .capture
            .as_mut()
            .ok_or("截图会话尚未就绪")?
            .capture(region, cancel);
        if result.is_err() {
            self.capture.take();
        }
        result
    }
}
impl Drop for NativeDriver {
    fn drop(&mut self) {
        self.capture.take();
        self.ocr.take();
        unsafe {
            RoUninitialize();
        }
    }
}
/// Foreground input is exclusive across concurrent tasks. A waiter observes its own
/// cancellation, so stopping it never blocks behind another task's long key hold.
fn acquire_input<'a>(
    lock: &'a Mutex<()>,
    cancel: &Cancellation,
) -> Result<std::sync::MutexGuard<'a, ()>, String> {
    loop {
        match lock.try_lock() {
            Ok(guard) => return Ok(guard),
            Err(std::sync::TryLockError::WouldBlock) => {
                if cancel.wait(Duration::from_millis(10)) {
                    return Err("已停止".into());
                }
            }
            Err(std::sync::TryLockError::Poisoned(_)) => return Err("前台输入锁异常".into()),
        }
    }
}

/// A found position may only drive input in the exact window it was captured from.
fn same_window(window: &BoundWindow, expected: Option<(u64, u32)>) -> Result<(), String> {
    match expected {
        Some((hwnd, pid)) if window.hwnd != hwnd || window.pid != pid => {
            Err("位置变量属于另一个窗口，请在当前窗口重新查找图片".into())
        }
        _ => Ok(()),
    }
}

impl Driver for NativeDriver {
    fn set_scale(&mut self, scale: Option<u32>) {
        self.scale = scale;
    }
    /// A live WGC session copies every presented frame of the game window even while the
    /// task only waits. Reopening costs about 0.13 s, so long pauses release it. The OCR
    /// worker stays: it is idle on a pipe read and TensorRT RTX takes seconds to restart.
    fn idle(&mut self) {
        self.capture.take();
    }
    fn local_time_ms(&self) -> Result<u64, String> {
        let mut local = SYSTEMTIME::default();
        let mut stamp = FILETIME::default();
        // Encode the local calendar fields as a continuous wall-clock value for comparison.
        unsafe { GetLocalTime(&mut local) };
        if unsafe { SystemTimeToFileTime(&local, &mut stamp) } == 0 {
            return Err("无法读取系统本地时间".into());
        }
        Ok(((u64::from(stamp.dwHighDateTime) << 32) | u64::from(stamp.dwLowDateTime)) / 10_000)
    }
    fn expect_window(&mut self, window: Option<(u64, u32)>) {
        self.expected_window = window;
    }
    fn resolve_window(&mut self, title: &str) -> Result<BoundWindow, String> {
        let matches: Vec<_> = windows()?
            .into_iter()
            .filter(|window| window.title == title)
            .collect();
        match matches.as_slice() {
            [window] => {
                validate_window(window)?;
                Ok(window.clone())
            }
            [] => Err(format!("找不到窗口：{title}")),
            _ => Err(format!("存在多个同名窗口：{title}，请关闭重复窗口后重试")),
        }
    }

    fn perform(
        &mut self,
        action: &Action,
        bindings: &Bindings,
        cancel: &Cancellation,
    ) -> Result<Option<(String, Value)>, String> {
        static INPUT_LOCK: std::sync::OnceLock<Mutex<()>> = std::sync::OnceLock::new();
        let _input_guard = if matches!(
            action,
            Action::Focus { .. }
                | Action::Click { .. }
                | Action::Drag { .. }
                | Action::Scroll { .. }
                | Action::Key { .. }
                | Action::KeyDown { .. }
                | Action::KeyUp { .. }
                | Action::Text { .. }
        ) {
            Some(acquire_input(
                INPUT_LOCK.get_or_init(|| Mutex::new(())),
                cancel,
            )?)
        } else {
            None
        };
        if let Action::KeyDown { keys } | Action::KeyUp { keys } = action {
            if cancel.is_cancelled() {
                return Err("已停止".into());
            }
            if matches!(action, Action::KeyDown { .. }) {
                if unsafe { GetForegroundWindow() }.is_null() {
                    return Err("没有可输入的前台窗口".into());
                }
                self.held_keys.press(keys)?;
            } else {
                self.held_keys.release(keys)?;
            }
            return Ok(None);
        }
        if let Action::Key { target: slot, .. } | Action::Text { target: slot, .. } = action {
            let hwnd = if let Some(slot) = slot {
                let direct;
                let window = if let Slot::Window(title) = slot {
                    direct = self.resolve_window(title)?;
                    &direct
                } else {
                    bindings.get(slot).ok_or("脚本使用的窗口尚未绑定")?
                };
                focus(window, cancel)?
            } else {
                let hwnd = unsafe { GetForegroundWindow() };
                if hwnd.is_null() {
                    return Err("没有可输入的前台窗口".into());
                }
                hwnd
            };
            match action {
                Action::Key { keys, hold_ms, .. } => {
                    let mut held =
                        crate::held_keys::HeldKeys::new(|key, up| send(key_input(key, up, false)));
                    for key in keys {
                        if cancel.is_cancelled() {
                            return Err("已停止".into());
                        }
                        if unsafe { GetForegroundWindow() } != hwnd {
                            return Err("目标窗口失去焦点，已停止按键输入".into());
                        }
                        if !self.held_keys.contains(*key) {
                            held.press(&[*key])?;
                        }
                    }
                    cancel.wait(Duration::from_millis(u64::from((*hold_ms).max(10))));
                }
                Action::Text { text, .. } => {
                    for key in text.encode_utf16() {
                        if cancel.is_cancelled() {
                            return Err("已停止".into());
                        }
                        if unsafe { GetForegroundWindow() } != hwnd {
                            return Err("目标窗口失去焦点，已停止文本输入".into());
                        }
                        send(key_input(key, false, true))?;
                        let held = Held(vec![Release::Key(key, true)]);
                        drop(held);
                    }
                }
                _ => unreachable!(),
            }
            return Ok(None);
        }
        let slot = match action {
            Action::Click { target, .. }
            | Action::Drag { target, .. }
            | Action::Scroll { target, .. }
            | Action::Focus { target }
            | Action::Ocr { target, .. }
            | Action::Capture { target, .. }
            | Action::Match { target, .. } => target,
            _ => return Err("操作无需原生执行".into()),
        };
        let direct;
        let window = if let Slot::Window(title) = slot {
            direct = self.resolve_window(title)?;
            &direct
        } else {
            bindings
                .get(slot)
                .ok_or_else(|| format!("窗口 {slot:?} 尚未绑定"))?
        };
        same_window(window, self.expected_window)?;
        let adjusted;
        let action = if let Some(source) = self.scale {
            if matches!(
                action,
                Action::Click {
                    mode: MouseMode::Foreground,
                    ..
                } | Action::Drag {
                    mode: MouseMode::Foreground,
                    ..
                } | Action::Scroll {
                    mode: MouseMode::Foreground,
                    ..
                }
            ) {
                focus(window, cancel)?;
            }
            adjusted = crate::coordinates::adapt(action, source, window_scale(window)?)?;
            &adjusted
        } else {
            action
        };
        if matches!(
            action,
            Action::Click {
                mode: MouseMode::Background,
                ..
            } | Action::Drag {
                mode: MouseMode::Background,
                ..
            } | Action::Scroll {
                mode: MouseMode::Background,
                ..
            }
        ) {
            crate::background_mouse::perform(action, window, cancel)?;
            return Ok(None);
        }
        match action {
            Action::Focus { .. } => {
                focus(window, cancel)?;
            }
            Action::Click {
                x,
                y,
                button,
                hold_ms,
                jitter,
                ..
            } => {
                let hwnd = focus(window, cancel)?;
                let mut rect: RECT = unsafe { std::mem::zeroed() };
                unsafe {
                    GetClientRect(hwnd, &mut rect);
                }
                let random = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .subsec_nanos();
                let spread = i32::from(*jitter);
                let ox = if spread > 0 {
                    (random % (2 * spread + 1) as u32) as i32 - spread
                } else {
                    0
                };
                let oy = if spread > 0 {
                    ((random / 131) % (2 * spread + 1) as u32) as i32 - spread
                } else {
                    0
                };
                let mut point = POINT {
                    x: *x + ox,
                    y: *y + oy,
                };
                if point.x < 0 || point.y < 0 || point.x >= rect.right || point.y >= rect.bottom {
                    return Err("点击位置超出窗口".into());
                }
                if unsafe { ClientToScreen(hwnd, &mut point) } == 0
                    || unsafe { SetCursorPos(point.x, point.y) } == 0
                {
                    return Err("移动鼠标失败".into());
                }
                let (down, up) = match button {
                    MouseButton::Left => (MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP),
                    MouseButton::Right => (MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP),
                    MouseButton::Middle => (MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP),
                };
                send(mouse_input(down))?;
                let _held = Held(vec![Release::Mouse(up)]);
                cancel.wait(Duration::from_millis(u64::from((*hold_ms).max(10))));
            }
            Action::Drag {
                from_x,
                from_y,
                to_x,
                to_y,
                duration_ms,
                button,
                ..
            } => {
                let hwnd = focus(window, cancel)?;
                let mut rect: RECT = unsafe { std::mem::zeroed() };
                unsafe {
                    GetClientRect(hwnd, &mut rect);
                }
                for (x, y) in [(*from_x, *from_y), (*to_x, *to_y)] {
                    if x < 0 || y < 0 || x >= rect.right || y >= rect.bottom {
                        return Err("拖动位置超出窗口".into());
                    }
                }
                let move_to = |x: i32, y: i32| -> Result<(), String> {
                    let mut point = POINT { x, y };
                    if unsafe { ClientToScreen(hwnd, &mut point) } == 0
                        || unsafe { SetCursorPos(point.x, point.y) } == 0
                    {
                        return Err("拖动鼠标失败".into());
                    }
                    Ok(())
                };
                move_to(*from_x, *from_y)?;
                let (down, up) = match button {
                    MouseButton::Left => (MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP),
                    MouseButton::Right => (MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP),
                    MouseButton::Middle => (MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP),
                };
                send(mouse_input(down))?;
                let held = Held(vec![Release::Mouse(up)]);
                let steps = ((*duration_ms / 8).clamp(1, 240)) as u64;
                let started = Instant::now();
                for index in 1..=steps {
                    if cancel.is_cancelled() {
                        return Err("已停止拖动".into());
                    }
                    if unsafe { GetForegroundWindow() } != hwnd {
                        return Err("目标窗口失去焦点，已停止拖动".into());
                    }
                    let x = *from_x as i64
                        + (*to_x as i64 - *from_x as i64) * index as i64 / steps as i64;
                    let y = *from_y as i64
                        + (*to_y as i64 - *from_y as i64) * index as i64 / steps as i64;
                    move_to(x as i32, y as i32)?;
                    let deadline = Duration::from_millis(u64::from(*duration_ms) * index / steps);
                    if let Some(remaining) = deadline.checked_sub(started.elapsed()) {
                        if cancel.wait(remaining) {
                            return Err("已停止拖动".into());
                        }
                    }
                }
                drop(held);
            }
            Action::Scroll { x, y, delta, .. } => {
                let hwnd = focus(window, cancel)?;
                let mut point = POINT { x: *x, y: *y };
                let mut rect: RECT = unsafe { std::mem::zeroed() };
                unsafe {
                    GetClientRect(hwnd, &mut rect);
                }
                if point.x < 0 || point.y < 0 || point.x >= rect.right || point.y >= rect.bottom {
                    return Err("滚动位置超出窗口".into());
                }
                if unsafe { ClientToScreen(hwnd, &mut point) } == 0
                    || unsafe { SetCursorPos(point.x, point.y) } == 0
                {
                    return Err("移动鼠标失败".into());
                }
                send(wheel_input(*delta))?;
            }
            Action::Ocr {
                region,
                variable,
                numbers_only,
                numeric_result,
                reuse,
                ..
            } => {
                let settings = self.ocr_settings.clone()?;
                let image = self.capture_frame(window, *region, cancel)?;
                let hash = Sha256::digest(image.as_raw()).to_vec();
                let cache_key = format!(
                    "{}:{}:{}:{}:{}:{}:{}",
                    window.hwnd,
                    region.x,
                    region.y,
                    region.width,
                    region.height,
                    settings.model.name(),
                    settings.device.name()
                );
                let mut text = if *reuse {
                    self.cache
                        .get(&cache_key)
                        .filter(|(cached, _)| *cached == hash)
                        .map(|(_, text)| text.clone())
                } else {
                    None
                };
                if text.is_none() {
                    let recognized = self.recognize(&image, cancel)?;
                    if self.cache.len() >= 16 {
                        self.cache.clear();
                    }
                    self.cache.insert(cache_key, (hash, recognized.clone()));
                    text = Some(recognized);
                }
                let text = text.unwrap_or_default();
                return Ok(Some((
                    variable.clone(),
                    crate::ocr_value::format_result(&text, *numbers_only, *numeric_result)?,
                )));
            }
            Action::Capture {
                region,
                name,
                directory,
                ..
            } => {
                let directory =
                    crate::engine::capture_directory(&self.directory, directory.as_deref())?;
                if !crate::engine::local_capture_path(&directory) {
                    return Err("截图不能保存到网络位置，请在本机重新选择保存文件夹".into());
                }
                let image = self.capture_frame(window, *region, cancel)?;
                std::fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
                let file = format!(
                    "{name}-{}.png",
                    SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_nanos()
                );
                image
                    .save(directory.join(&file))
                    .map_err(|e| e.to_string())?;
                return Ok(Some(("last_capture".into(), json!(file))));
            }
            Action::Match {
                region,
                template,
                threshold,
                variable,
                save_position,
                template_point,
                ..
            } => {
                let image = self.capture_frame(window, *region, cancel)?;
                let template = load_template(&self.directory, template)?;
                let found =
                    find_template_at(&image, &template, *threshold, *template_point, cancel)?;
                let scale = window_scale(window)?;
                let result = if *save_position {
                    found.map_or(Value::Null, |(x,y)| json!({"x":i64::from(region.x)+i64::from(x),"y":i64::from(region.y)+i64::from(y),"target":slot,"scale":scale,"hwnd":window.hwnd,"pid":window.pid}))
                } else {
                    json!(found.is_some())
                };
                return Ok(Some((variable.clone(), result)));
            }
            _ => {}
        }
        Ok(None)
    }
}
pub fn read_limited(path: &Path, max: u64) -> Result<Vec<u8>, String> {
    let file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut bytes = Vec::new();
    file.take(max + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() as u64 > max {
        return Err("文件超过大小限制".into());
    }
    Ok(bytes)
}
fn decode_image(bytes: &[u8]) -> Result<RgbaImage, String> {
    if bytes.len() > 8 * 1024 * 1024 {
        return Err("图片超过 8 MiB".into());
    }
    let mut reader = ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|e| e.to_string())?;
    let mut limits = image::Limits::default();
    limits.max_image_width = Some(4096);
    limits.max_image_height = Some(4096);
    limits.max_alloc = Some(80 * 1024 * 1024);
    reader.limits(limits);
    reader
        .decode()
        .map(|i| i.into_rgba8())
        .map_err(|e| e.to_string())
}
pub fn import_template(bytes: &[u8], directory: &Path) -> Result<String, String> {
    let image = decode_image(bytes)?;
    if image.width() > 512 || image.height() > 512 {
        return Err("匹配模板请控制在 512×512 内".into());
    }
    let mut out = Cursor::new(Vec::new());
    image
        .write_to(&mut out, image::ImageFormat::Png)
        .map_err(|e| e.to_string())?;
    let bytes = out.into_inner();
    let id = format!("{:x}", Sha256::digest(&bytes));
    let dir = directory.join("templates");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let mut file = tempfile::NamedTempFile::new_in(&dir).map_err(|e| e.to_string())?;
    file.write_all(&bytes).map_err(|e| e.to_string())?;
    file.persist(dir.join(format!("{id}.png")))
        .map_err(|e| e.to_string())?;
    Ok(id)
}
pub fn load_template(directory: &Path, id: &str) -> Result<RgbaImage, String> {
    if id.len() != 64 || !id.bytes().all(|c| c.is_ascii_hexdigit()) {
        return Err("模板标识无效".into());
    }
    let bytes = read_limited(
        &directory.join("templates").join(format!("{id}.png")),
        8 * 1024 * 1024,
    )?;
    let image = decode_image(&bytes)?;
    if image.width() > 512 || image.height() > 512 {
        return Err("模板尺寸超过512像素".into());
    }
    Ok(image)
}
pub fn png_preview(image: &RgbaImage) -> Result<Vec<u8>, String> {
    let scale = (900.0 / image.width() as f64)
        .min(600.0 / image.height() as f64)
        .min(1.0);
    let width = (image.width() as f64 * scale).round().max(1.0) as u32;
    let height = (image.height() as f64 * scale).round().max(1.0) as u32;
    let preview = image::imageops::thumbnail(image, width, height);
    let mut out = Cursor::new(Vec::new());
    preview
        .write_to(&mut out, image::ImageFormat::Png)
        .map_err(|e| e.to_string())?;
    Ok(out.into_inner())
}
#[test]
fn preview_keeps_aspect_ratio_and_full_image_edges() {
    for (w, h, expected) in [
        (1600, 900, (900, 506)),
        (900, 1600, (338, 600)),
        (320, 200, (320, 200)),
    ] {
        let mut source = RgbaImage::from_pixel(w, h, image::Rgba([0, 0, 0, 255]));
        for y in h - 16..h {
            for x in w - 16..w {
                source.put_pixel(x, y, image::Rgba([255, 0, 0, 255]));
            }
        }
        let preview = image::load_from_memory(&png_preview(&source).unwrap())
            .unwrap()
            .to_rgba8();
        assert_eq!(preview.dimensions(), expected);
        assert_eq!(
            preview.get_pixel(expected.0 - 1, expected.1 - 1).0,
            [255, 0, 0, 255]
        );
    }
}
#[cfg(test)]
fn find_template(
    source: &RgbaImage,
    template: &RgbaImage,
    threshold: f64,
    cancel: &Cancellation,
) -> Result<Option<(u32, u32)>, String> {
    find_template_at(source, template, threshold, None, cancel)
}
fn find_template_at(
    source: &RgbaImage,
    template: &RgbaImage,
    threshold: f64,
    point: Option<TemplatePoint>,
    cancel: &Cancellation,
) -> Result<Option<(u32, u32)>, String> {
    let point = point.unwrap_or(TemplatePoint {
        x: template.width() / 2,
        y: template.height() / 2,
    });
    if point.x >= template.width() || point.y >= template.height() {
        return Err("保存位置超出模板图片，请重新选择图片上的位置".into());
    }
    if template.width() > source.width() || template.height() > source.height() {
        return Ok(None);
    }
    let samples: Vec<_> = template
        .enumerate_pixels()
        .filter(|(_, _, p)| p[3] > 0)
        .map(|(x, y, p)| (x, y, *p))
        .collect();
    if samples.is_empty() {
        return Err("模板完全透明".into());
    }
    let allowed = (1.0 - threshold) * samples.len() as f64 * 765.0;
    let mut comparisons = 0;
    for y in 0..=source.height() - template.height() {
        if cancel.is_cancelled() {
            return Err("已停止".into());
        }
        for x in 0..=source.width() - template.width() {
            let mut error = 0u64;
            for (tx, ty, p) in &samples {
                let s = source.get_pixel(x + tx, y + ty);
                error += u64::from(s[0].abs_diff(p[0]))
                    + u64::from(s[1].abs_diff(p[1]))
                    + u64::from(s[2].abs_diff(p[2]));
                comparisons += 1;
                if comparisons > 50_000_000 {
                    return Err("匹配计算量过大，请缩小区域或模板".into());
                }
                if error as f64 > allowed {
                    break;
                }
            }
            if error as f64 <= allowed {
                return Ok(Some((x + point.x, y + point.y)));
            }
        }
    }
    Ok(None)
}

struct HotkeyRegistry {
    tokens: Arc<Mutex<BTreeMap<u64, Cancellation>>>,
    thread_id: u32,
    join: Option<thread::JoinHandle<()>>,
    next_id: u64,
    settings: Option<crate::hotkey_settings::HotkeySettings>,
}
static HOTKEY: std::sync::OnceLock<Mutex<HotkeyRegistry>> = std::sync::OnceLock::new();
fn hotkey_registry() -> &'static Mutex<HotkeyRegistry> {
    HOTKEY.get_or_init(|| {
        Mutex::new(HotkeyRegistry {
            tokens: Arc::new(Mutex::new(BTreeMap::new())),
            thread_id: 0,
            join: None,
            next_id: 0,
            settings: None,
        })
    })
}
struct Emergency {
    id: u64,
}
pub fn save_hotkey_settings(
    directory: &Path,
    settings: crate::hotkey_settings::HotkeySettings,
) -> Result<(), String> {
    settings.validate()?;
    let global = hotkey_registry().lock().map_err(|_| "快捷键状态锁异常")?;
    if global.join.is_some() {
        return Err("请先停止所有任务再修改紧急停止快捷键".into());
    }
    // Probe before persisting; a conflicting shortcut must not replace the working setting.
    unsafe {
        if RegisterHotKey(
            null_mut(),
            102,
            settings.modifiers | MOD_NOREPEAT,
            settings.key,
        ) == 0
        {
            return Err("紧急停止快捷键已被占用或系统不支持，请更换组合键".into());
        }
        let result = crate::hotkey_settings::save(directory, settings);
        UnregisterHotKey(null_mut(), 102);
        result
    }
}
impl Emergency {
    fn new(cancel: Cancellation, directory: &Path) -> Result<Self, String> {
        let mut global = hotkey_registry().lock().map_err(|_| "快捷键状态锁异常")?;
        let settings = crate::hotkey_settings::load(directory)?;
        if global.join.is_some() && global.settings != Some(settings) {
            return Err("紧急停止快捷键与正在运行的任务不一致，请先停止所有任务".into());
        }
        if global.join.is_none() {
            let tokens = global.tokens.clone();
            let (send, ready) = mpsc::channel();
            let join = thread::spawn(move || unsafe {
                let mut message: MSG = std::mem::zeroed();
                PeekMessageW(&mut message, null_mut(), 0, 0, PM_NOREMOVE);
                if RegisterHotKey(
                    null_mut(),
                    101,
                    settings.modifiers | MOD_NOREPEAT,
                    settings.key,
                ) == 0
                {
                    let _ = send.send(Err(
                        "紧急停止快捷键已被占用或系统不支持，请在快捷键设置中修改".to_string(),
                    ));
                    return;
                }
                let _ = send.send(Ok(GetCurrentThreadId()));
                while GetMessageW(&mut message, null_mut(), 0, 0) > 0 {
                    if message.message == WM_HOTKEY {
                        if let Ok(active) = tokens.lock() {
                            for token in active.values() {
                                if message.wParam == 101 {
                                    token.cancel();
                                }
                            }
                        }
                    }
                }
                UnregisterHotKey(null_mut(), 101);
            });
            match ready.recv().map_err(|e| e.to_string())? {
                Ok(id) => {
                    global.thread_id = id;
                    global.settings = Some(settings);
                    global.join = Some(join)
                }
                Err(error) => {
                    let _ = join.join();
                    return Err(error);
                }
            }
        }
        global.next_id += 1;
        let id = global.next_id;
        global
            .tokens
            .lock()
            .map_err(|_| "快捷键注册锁异常")?
            .insert(id, cancel);
        Ok(Self { id })
    }
}
impl Drop for Emergency {
    fn drop(&mut self) {
        if let Ok(mut global) = hotkey_registry().lock() {
            if let Ok(mut active) = global.tokens.lock() {
                active.remove(&self.id);
                if !active.is_empty() {
                    return;
                }
            } else {
                return;
            }
            unsafe {
                PostThreadMessageW(global.thread_id, WM_QUIT, 0, 0);
            }
            if let Some(join) = global.join.take() {
                let _ = join.join();
            }
            global.thread_id = 0;
            global.settings = None;
        }
    }
}

type Observer = Arc<dyn Fn(Status) + Send + Sync>;

#[cfg(test)]
mod emergency_tests {
    use super::*;
    use crate::hotkey_settings::{self, HotkeySettings};

    #[test]
    #[ignore = "two-minute real hotkey message-loop endurance test; run alone"]
    fn emergency_remains_responsive_after_two_minutes() {
        let dir = tempfile::tempdir().unwrap();
        let settings = HotkeySettings {
            key: 135,
            modifiers: 7,
            ..HotkeySettings::default()
        };
        save_hotkey_settings(dir.path(), settings).unwrap();
        let token = Cancellation::default();
        let guard = Emergency::new(token.clone(), dir.path()).unwrap();
        std::thread::sleep(Duration::from_secs(120));
        let id = hotkey_registry().lock().unwrap().thread_id;
        let start = Instant::now();
        assert_ne!(unsafe { PostThreadMessageW(id, WM_HOTKEY, 101, 0) }, 0);
        assert!(token.wait(Duration::from_secs(2)));
        assert!(start.elapsed() < Duration::from_secs(2));
        drop(guard);
    }

    #[test]
    #[ignore = "Uses a process-wide custom hotkey; run alone to avoid concurrent default-hotkey task tests"]
    fn custom_hotkey_cancels_all_runs_releases_and_preserves_settings_on_conflict() {
        let dir = tempfile::tempdir().unwrap();
        let settings = HotkeySettings {
            key: 135,
            modifiers: 7,
            ..HotkeySettings::default()
        };
        save_hotkey_settings(dir.path(), settings).unwrap();
        let first = Cancellation::default();
        let second = Cancellation::default();
        let a = Emergency::new(first.clone(), dir.path()).unwrap();
        let b = Emergency::new(second.clone(), dir.path()).unwrap();
        assert!(save_hotkey_settings(dir.path(), HotkeySettings::default()).is_err());
        assert_eq!(hotkey_settings::load(dir.path()).unwrap(), settings);
        let id = hotkey_registry().lock().unwrap().thread_id;
        // Deliver the Windows hotkey notification to the registered message thread.
        assert_ne!(unsafe { PostThreadMessageW(id, WM_HOTKEY, 101, 0) }, 0);
        let deadline = Instant::now() + Duration::from_secs(2);
        while (!first.is_cancelled() || !second.is_cancelled()) && Instant::now() < deadline {
            thread::sleep(Duration::from_millis(5));
        }
        assert!(first.is_cancelled() && second.is_cancelled());
        drop(a);
        assert!(hotkey_registry().lock().unwrap().join.is_some());
        drop(b);
        assert!(hotkey_registry().lock().unwrap().join.is_none());
        unsafe {
            assert_ne!(
                RegisterHotKey(
                    null_mut(),
                    103,
                    settings.modifiers | MOD_NOREPEAT,
                    settings.key
                ),
                0
            );
            let result = save_hotkey_settings(dir.path(), settings);
            UnregisterHotKey(null_mut(), 103);
            assert!(result.unwrap_err().contains("已被占用"));
        }
        assert_eq!(hotkey_settings::load(dir.path()).unwrap(), settings);
        save_hotkey_settings(dir.path(), settings).unwrap();
        let retry = Emergency::new(Cancellation::default(), dir.path()).unwrap();
        drop(retry);
    }
}

pub struct Automation {
    directory: PathBuf,
    task: TaskSlot,
    state: Arc<Mutex<Status>>,
    observer: Observer,
}
impl Automation {
    pub fn new(directory: PathBuf, observer: impl Fn(Status) + Send + Sync + 'static) -> Self {
        Self {
            directory,
            task: TaskSlot::default(),
            state: Arc::new(Mutex::new(Status::idle())),
            observer: Arc::new(observer),
        }
    }
    pub fn status(&self) -> Status {
        self.state.lock().unwrap_or_else(|e| e.into_inner()).clone()
    }
    pub fn start(&mut self, script: Script, bindings: Bindings) -> Result<Status, String> {
        if self.task.is_running() {
            return Err("自动化正在运行".into());
        }
        let plan = Plan::compile(crate::tasks::expand_calls(&self.directory, script)?)?;
        let dynamic_slots: std::collections::BTreeSet<_> = plan
            .script
            .steps
            .iter()
            .filter_map(|step| {
                if let Action::SetWindow { target, .. } = &step.action {
                    Some(target.clone())
                } else {
                    None
                }
            })
            .collect();
        let mut all_actions = Vec::new();
        for step in &plan.script.steps {
            all_actions.push(&step.action);
            if let Some(inputs) = &step.inputs {
                for value in inputs.values.values() {
                    value.query_actions(&mut all_actions);
                }
            }
        }
        for action in all_actions {
            let slot = match action {
                Action::Focus { target }
                | Action::Click { target, .. }
                | Action::Drag { target, .. }
                | Action::Scroll { target, .. }
                | Action::Ocr { target, .. }
                | Action::Match { target, .. }
                | Action::Capture { target, .. } => Some(target),
                Action::Key { target, .. } | Action::Text { target, .. } => target.as_ref(),
                _ => None,
            };
            if let Some(slot) = slot.filter(|slot| !dynamic_slots.contains(slot)) {
                if !matches!(slot, Slot::Window(_)) {
                    target(bindings.get(slot).ok_or("脚本使用的窗口尚未绑定")?)?;
                }
            }
        }
        let directory = self.directory.clone();
        let shared = self.state.clone();
        let observer = self.observer.clone();
        // Status metadata must not make non-OCR tasks depend on valid OCR settings.
        // NativeDriver retains the original error and reports it if OCR is actually used.
        let (ocr_model, ocr_device) = crate::ocr_settings::load(&directory)
            .map(|ocr| (ocr.model.name().to_string(), ocr.device.name().to_string()))
            .unwrap_or_default();
        let stop_hotkey = crate::hotkey_settings::load(&directory)?.display();
        let initial = Status {
            running: true,
            phase: "starting".into(),
            task_name: plan.script.name.clone(),
            total_steps: plan
                .script
                .execution_map
                .iter()
                .max()
                .map_or(plan.script.steps.len(), |i| i + 1),
            ocr_model: ocr_model.clone(),
            ocr_device: ocr_device.clone(),
            stop_hotkey: stop_hotkey.clone(),
            ..Status::default()
        };
        *self.state.lock().map_err(|_| "状态锁异常")? = initial.clone();
        (self.observer)(initial.clone());
        let started = self.task.start("automation-runner", move |cancel| {
            let publish = |mut status: Status| {
                status.ocr_model = ocr_model.clone();
                status.ocr_device = ocr_device.clone();
                status.stop_hotkey = stop_hotkey.clone();
                *shared.lock().unwrap_or_else(|e| e.into_inner()) = status.clone();
                observer(status);
            };
            let result = (|| {
                let _emergency = Emergency::new(cancel.clone(), &directory)?;
                let mut driver = NativeDriver::new(directory)?;
                plan.run(&mut driver, &bindings, &cancel, &publish)
            })();
            let final_state = match result {
                Ok(status) => status,
                Err(error) => {
                    let mut status = shared.lock().unwrap_or_else(|e| e.into_inner()).clone();
                    status.running = false;
                    status.phase = if cancel.is_cancelled() {
                        "stopped"
                    } else {
                        "failed"
                    }
                    .into();
                    status.error = if cancel.is_cancelled() {
                        None
                    } else {
                        Some(error)
                    };
                    status
                }
            };
            publish(final_state);
        });
        if let Err(error) = started {
            let failed = Status {
                phase: "failed".into(),
                error: Some(error.clone()),
                ..Status::default()
            };
            *self.state.lock().map_err(|_| "状态锁异常")? = failed.clone();
            (self.observer)(failed);
            return Err(error);
        }
        Ok(initial)
    }
    pub fn stop(&mut self) -> Result<Status, String> {
        self.task.stop()?;
        Ok(self.status())
    }
    pub fn cancel(&self) {
        self.task.cancel();
    }
}

pub fn save_script(directory: &Path, script: &Script) -> Result<String, String> {
    Plan::compile(script.clone())?;
    let bytes = serde_json::to_vec_pretty(script).map_err(|e| e.to_string())?;
    if bytes.len() > 1024 * 1024 {
        return Err("脚本文件不能超过 1 MiB".into());
    }
    let id = format!("{:x}", Sha256::digest(script.name.as_bytes()));
    let folder = directory.join("scripts");
    std::fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    if folder.join(format!("{id}.json")).exists() {
        Plan::compile(load_script(directory, &id)?)?;
    }
    let mut temp = tempfile::NamedTempFile::new_in(&folder).map_err(|e| e.to_string())?;
    temp.write_all(&bytes).map_err(|e| e.to_string())?;
    temp.as_file().sync_all().map_err(|e| e.to_string())?;
    temp.persist(folder.join(format!("{id}.json")))
        .map_err(|e| e.to_string())?;
    Ok(id)
}
pub fn load_script(directory: &Path, id: &str) -> Result<Script, String> {
    if id.len() != 64 || !id.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err("脚本标识无效".into());
    }
    let bytes = read_limited(
        &directory.join("scripts").join(format!("{id}.json")),
        1024 * 1024,
    )?;
    serde_json::from_slice(&bytes).map_err(|e| e.to_string())
}
pub fn list_scripts(directory: &Path) -> Result<Value, String> {
    let folder = directory.join("scripts");
    if !folder.exists() {
        return Ok(json!([]));
    }
    let mut output = Vec::new();
    for entry in std::fs::read_dir(folder)
        .map_err(|e| e.to_string())?
        .take(200)
    {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if let Some(id) = name.strip_suffix(".json") {
            if let Ok(script) = load_script(directory, id) {
                output.push(json!({"id":id,"name":script.name}));
            }
        }
    }
    Ok(json!(output))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn found_position_only_drives_the_window_it_was_captured_from() {
        let window = BoundWindow {
            hwnd: 7,
            pid: 42,
            title: "game".into(),
            width: 100,
            height: 100,
        };
        assert!(same_window(&window, None).is_ok());
        assert!(same_window(&window, Some((7, 42))).is_ok());
        // Same slot rebound to another window, or a reused handle in another process.
        assert!(same_window(&window, Some((8, 42))).is_err());
        assert!(same_window(&window, Some((7, 43))).is_err());
    }
    #[test]
    fn input_lock_waiter_stops_without_waiting_for_holder() {
        let lock = Arc::new(Mutex::new(()));
        let held = lock.lock().unwrap();
        let cancel = Cancellation::default();
        let (waiter_lock, waiter_cancel) = (lock.clone(), cancel.clone());
        let (tx, rx) = mpsc::channel();
        let waiter = thread::spawn(move || {
            tx.send(acquire_input(&waiter_lock, &waiter_cancel).map(drop))
                .unwrap();
        });
        assert!(rx.recv_timeout(Duration::from_millis(100)).is_err());
        let started = Instant::now();
        cancel.cancel();
        assert_eq!(
            rx.recv_timeout(Duration::from_secs(2)).unwrap(),
            Err("已停止".into())
        );
        assert!(started.elapsed() < Duration::from_secs(1));
        waiter.join().unwrap();
        drop(held);
        let next = Cancellation::default();
        let deferred = lock.lock().unwrap();
        let (waiter_lock, waiter_next) = (lock.clone(), next.clone());
        let waiter = thread::spawn(move || acquire_input(&waiter_lock, &waiter_next).map(drop));
        thread::sleep(Duration::from_millis(30));
        drop(deferred);
        assert_eq!(waiter.join().unwrap(), Ok(()));
    }
    #[test]
    fn drivers_snapshot_global_ocr_settings_without_starting_inference() {
        use crate::ocr_settings::{self, OcrDevice, OcrSettings};
        let directory = tempfile::tempdir().unwrap();
        let selected = OcrSettings {
            model: OcrModel::Tiny,
            device: OcrDevice::Nvidia,
            ..OcrSettings::default()
        };
        ocr_settings::save(directory.path(), selected).unwrap();
        let running = NativeDriver::new(directory.path().into()).unwrap();
        assert_eq!(running.ocr_settings.clone().unwrap(), selected);
        assert!(running.ocr.is_none());
        ocr_settings::save(directory.path(), OcrSettings::default()).unwrap();
        assert_eq!(running.ocr_settings.clone().unwrap(), selected);
        let next = NativeDriver::new(directory.path().into()).unwrap();
        assert_eq!(next.ocr_settings.clone().unwrap(), OcrSettings::default());
        assert!(next.ocr.is_none());
    }
    #[test]
    fn script_save_preserves_unreadable_data_and_rejects_oversize() {
        let directory = tempfile::tempdir().unwrap();
        let mut script: Script = serde_json::from_value(json!({
            "schemaVersion":1,"name":"save-test","repeats":1,
            "maxRunSeconds":60,"startDelayMs":0,
            "steps":[{"action":{"type":"wait","ms":1}}]
        }))
        .unwrap();
        let id = save_script(directory.path(), &script).unwrap();
        let path = directory.path().join("scripts").join(format!("{id}.json"));
        std::fs::write(&path, b"unreadable user data").unwrap();
        assert!(save_script(directory.path(), &script).is_err());
        assert_eq!(std::fs::read(&path).unwrap(), b"unreadable user data");
        script.name = "large".into();
        script.steps = (0..300)
            .map(|_| crate::model::Step {
                inputs: None,
                annotation: None,
                delay_ms: 0,
                random_delay_ms: 0,
                action: Action::Text {
                    target: Some(crate::model::Slot::A),
                    text: "x".repeat(4096),
                },
            })
            .collect();
        assert!(save_script(directory.path(), &script)
            .unwrap_err()
            .contains("1 MiB"));
    }
    #[test]
    fn matching_detects_only_the_requested_template() {
        let mut source = RgbaImage::from_pixel(8, 8, image::Rgba([0, 0, 0, 255]));
        let template = RgbaImage::from_pixel(2, 2, image::Rgba([255, 255, 255, 255]));
        image::imageops::replace(&mut source, &template, 3, 4);
        assert_eq!(
            find_template(&source, &template, 1.0, &Cancellation::default()).unwrap(),
            Some((4, 5))
        );
        for (point, expected) in [
            (TemplatePoint { x: 0, y: 0 }, (3, 4)),
            (TemplatePoint { x: 1, y: 0 }, (4, 4)),
            (TemplatePoint { x: 0, y: 1 }, (3, 5)),
        ] {
            assert_eq!(
                find_template_at(
                    &source,
                    &template,
                    1.0,
                    Some(point),
                    &Cancellation::default()
                )
                .unwrap(),
                Some(expected)
            );
        }
        assert!(find_template_at(
            &source,
            &template,
            1.0,
            Some(TemplatePoint { x: 2, y: 0 }),
            &Cancellation::default()
        )
        .is_err());
        let wrong = RgbaImage::from_pixel(2, 2, image::Rgba([255, 0, 0, 255]));
        assert!(
            find_template(&source, &wrong, 1.0, &Cancellation::default())
                .unwrap()
                .is_none()
        );
    }
    #[test]
    fn template_preview_is_bounded_to_the_template_store() {
        let directory = tempfile::tempdir().unwrap();
        let image = RgbaImage::from_pixel(4, 3, image::Rgba([0, 0, 0, 255]));
        let mut data = Cursor::new(Vec::new());
        image.write_to(&mut data, image::ImageFormat::Png).unwrap();
        let id = import_template(&data.into_inner(), directory.path()).unwrap();
        let image = load_template(directory.path(), &id).unwrap();
        assert_eq!(image.dimensions(), (4, 3));
        assert!(load_template(directory.path(), "../file").is_err());
        assert!(load_template(directory.path(), &"a".repeat(64)).is_err());
    }
}
