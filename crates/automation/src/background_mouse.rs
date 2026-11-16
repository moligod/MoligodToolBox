use crate::{model::*, native::target};
use moligod_core::task::Cancellation;
use std::time::{Duration, Instant};
use windows_sys::Win32::{
    Foundation::*, Graphics::Gdi::ClientToScreen, UI::WindowsAndMessaging::*,
};

fn packed(x: i32, y: i32) -> Result<LPARAM, String> {
    if i16::try_from(x).is_err() || i16::try_from(y).is_err() {
        return Err("后台鼠标坐标超出消息范围".into());
    }
    Ok(((x as u16 as u32) | ((y as u16 as u32) << 16)) as LPARAM)
}

struct Sender<'a> {
    window: &'a BoundWindow,
    hwnd: HWND,
    up: Option<u32>,
    last: LPARAM,
}
impl Sender<'_> {
    fn post(&self, message: u32, keys: usize, point: LPARAM) -> Result<(), String> {
        target(self.window)?;
        if unsafe { PostMessageW(self.hwnd, message, keys, point) } == 0 {
            return Err("后台鼠标消息发送失败，请检查目标窗口权限".into());
        }
        Ok(())
    }
    fn move_to(&mut self, x: i32, y: i32, keys: usize) -> Result<(), String> {
        self.last = packed(x, y)?;
        self.post(WM_MOUSEMOVE, keys, self.last)
    }
    fn release(&mut self) -> Result<(), String> {
        if let Some(up) = self.up {
            self.post(up, 0, self.last)?;
            self.up = None;
        }
        Ok(())
    }
}
impl Drop for Sender<'_> {
    fn drop(&mut self) {
        let _ = self.release();
    }
}

pub(crate) fn perform(
    action: &Action,
    window: &BoundWindow,
    cancel: &Cancellation,
) -> Result<(), String> {
    let hwnd = target(window)?;
    let mut rect: RECT = unsafe { std::mem::zeroed() };
    if unsafe { GetClientRect(hwnd, &mut rect) } == 0 {
        return Err("无法读取后台窗口尺寸".into());
    }
    let (x, y, end, button, duration) = match action {
        Action::Click {
            x,
            y,
            button,
            hold_ms,
            jitter,
            ..
        } => {
            let spread = i32::from(*jitter);
            let seed = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .subsec_nanos();
            let offset = |seed: u32| (seed % (2 * spread + 1) as u32) as i32 - spread;
            (
                x.saturating_add(offset(seed)),
                y.saturating_add(offset(seed / 131)),
                None,
                Some(button),
                (*hold_ms).max(10),
            )
        }
        Action::Drag {
            from_x,
            from_y,
            to_x,
            to_y,
            button,
            duration_ms,
            ..
        } => (
            *from_x,
            *from_y,
            Some((*to_x, *to_y)),
            Some(button),
            *duration_ms,
        ),
        Action::Scroll { x, y, .. } => (*x, *y, None, None, 0),
        _ => return Err("不支持的后台鼠标动作".into()),
    };
    for (px, py) in [(x, y), end.unwrap_or((x, y))] {
        if px < 0 || py < 0 || px >= rect.right || py >= rect.bottom {
            return Err("后台鼠标位置超出窗口".into());
        }
        packed(px, py)?;
    }
    if cancel.is_cancelled() {
        return Err("已停止鼠标操作".into());
    }
    let mut sender = Sender {
        window,
        hwnd,
        up: None,
        last: packed(x, y)?,
    };
    sender.move_to(x, y, 0)?;
    if let Action::Scroll { delta, .. } = action {
        // Wheel messages use screen coordinates; other mouse messages use client coordinates.
        let mut point = POINT { x, y };
        if unsafe { ClientToScreen(hwnd, &mut point) } == 0 {
            return Err("无法转换滚动位置".into());
        }
        return sender.post(
            WM_MOUSEWHEEL,
            ((*delta as u16 as u32) << 16) as usize,
            packed(point.x, point.y)?,
        );
    }
    let (down, up, keys) = match button.ok_or("缺少鼠标按键")? {
        MouseButton::Left => (WM_LBUTTONDOWN, WM_LBUTTONUP, 1),
        MouseButton::Right => (WM_RBUTTONDOWN, WM_RBUTTONUP, 2),
        MouseButton::Middle => (WM_MBUTTONDOWN, WM_MBUTTONUP, 16),
    };
    sender.post(down, keys, sender.last)?;
    sender.up = Some(up);
    let steps = if end.is_some() {
        (duration / 8).clamp(1, 240)
    } else {
        1
    };
    let start = Instant::now();
    for i in 1..=steps {
        if cancel.is_cancelled() {
            return Err("已停止鼠标操作".into());
        }
        if let Some((tx, ty)) = end {
            sender.move_to(
                x + ((tx - x) as i64 * i as i64 / steps as i64) as i32,
                y + ((ty - y) as i64 * i as i64 / steps as i64) as i32,
                keys,
            )?;
        }
        let deadline = Duration::from_millis(u64::from(duration) * u64::from(i) / u64::from(steps));
        if deadline
            .checked_sub(start.elapsed())
            .is_some_and(|remaining| cancel.wait(remaining))
        {
            return Err("已停止鼠标操作".into());
        }
    }
    sender.release()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn background_messages_reach_window_and_cancel_releases_button() {
        unsafe {
            let class: Vec<u16> = "STATIC\0".encode_utf16().collect();
            let hwnd = CreateWindowExW(
                0,
                class.as_ptr(),
                class.as_ptr(),
                WS_POPUP,
                50,
                60,
                200,
                160,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null(),
            );
            assert!(!hwnd.is_null());
            struct Window(HWND);
            impl Drop for Window {
                fn drop(&mut self) {
                    unsafe {
                        DestroyWindow(self.0);
                    }
                }
            }
            let _window = Window(hwnd);
            let mut pid = 0;
            GetWindowThreadProcessId(hwnd, &mut pid);
            let window = BoundWindow {
                hwnd: hwnd as u64,
                pid,
                title: "test".into(),
                width: 200,
                height: 160,
            };
            let read = || {
                let mut events = Vec::new();
                let mut msg: MSG = std::mem::zeroed();
                while PeekMessageW(&mut msg, hwnd, WM_MOUSEFIRST, WM_MOUSELAST, PM_REMOVE) != 0 {
                    events.push((msg.message, msg.wParam, msg.lParam));
                }
                events
            };
            let foreground = GetForegroundWindow();
            let action = |value| serde_json::from_value::<Action>(value).unwrap();
            let click = action(
                serde_json::json!({"type":"click","target":"A","mode":"background","x":20,"y":30,"button":"right","holdMs":10}),
            );
            perform(&click, &window, &Cancellation::default()).unwrap();
            let events = read();
            assert!(events.contains(&(WM_RBUTTONDOWN, 2, packed(20, 30).unwrap())));
            assert_eq!(
                events.last(),
                Some(&(WM_RBUTTONUP, 0, packed(20, 30).unwrap()))
            );
            assert_eq!(GetForegroundWindow(), foreground);
            let scroll = action(
                serde_json::json!({"type":"scroll","target":"A","mode":"background","x":20,"y":30,"delta":-120}),
            );
            perform(&scroll, &window, &Cancellation::default()).unwrap();
            let events = read();
            let wheel = events.iter().find(|e| e.0 == WM_MOUSEWHEEL).unwrap();
            assert_eq!((wheel.1 >> 16) as i16, -120);
            let mut point = POINT { x: 20, y: 30 };
            assert_ne!(ClientToScreen(hwnd, &mut point), 0);
            assert_eq!(wheel.2, packed(point.x, point.y).unwrap());
            let drag = action(
                serde_json::json!({"type":"drag","target":"A","mode":"background","fromX":20,"fromY":30,"toX":100,"toY":80,"durationMs":1000,"button":"left"}),
            );
            let cancel = Cancellation::default();
            let child = cancel.clone();
            let worker = std::thread::spawn(move || {
                std::thread::sleep(Duration::from_millis(30));
                child.cancel();
            });
            assert!(perform(&drag, &window, &cancel).is_err());
            worker.join().unwrap();
            let events = read();
            assert!(events.iter().any(|e| e.0 == WM_LBUTTONDOWN));
            assert_eq!(events.last().unwrap().0, WM_LBUTTONUP);
            assert!(perform(&click, &window, &cancel).is_err());
            assert!(read().is_empty());
        }
    }
    #[test]
    fn signed_message_coordinates_and_limits() {
        let value = packed(-123, 456).unwrap();
        assert_eq!(value as i16, -123);
        assert_eq!((value >> 16) as i16, 456);
        assert!(packed(32768, 0).is_err());
        assert!(packed(0, -32769).is_err());
    }
}
