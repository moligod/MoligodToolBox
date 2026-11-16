use moligod_core::config::{Crosshair, CrosshairStyle};
use moligod_crosshair::Overlay;
use std::time::Duration;
use windows_sys::Win32::{
    Foundation::HWND,
    System::Threading::{GetCurrentProcess, GetGuiResources, GR_GDIOBJECTS},
    UI::WindowsAndMessaging::*,
};

fn main() {
    let directory = std::env::temp_dir().join("moligod-crosshair-smoke");
    let mut overlay = Overlay::new(directory, |_| {});
    let config = Crosshair {
        hotkey: None,
        ..Crosshair::default()
    };
    unsafe {
        windows_sys::Win32::UI::HiDpi::SetThreadDpiAwarenessContext(
            windows_sys::Win32::UI::HiDpi::DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2,
        );
    }
    if std::env::args().any(|arg| arg == "--hold") {
        overlay.start(config).unwrap();
        println!("OVERLAY_PID={}", std::process::id());
        std::thread::sleep(Duration::from_secs(45));
        overlay.stop().unwrap();
        return;
    }
    if std::env::args().any(|arg| arg == "--mode-switch") {
        let config = Crosshair {
            hotkey: Some(119),
            ..config
        };
        overlay.start(config.clone()).unwrap();
        overlay.show(false).unwrap();
        let switched = overlay
            .apply(Crosshair {
                hotkey_mode: moligod_core::config::HotkeyMode::Hold,
                ..config.clone()
            })
            .unwrap();
        assert!(
            switched.visible,
            "switching from a hidden toggle to hold-hide must restore the released state"
        );
        assert_ne!(
            unsafe { IsWindowVisible(overlay.window_handle().unwrap() as HWND) },
            0
        );
        let mut show_on_hold = Crosshair {
            hotkey_mode: moligod_core::config::HotkeyMode::HoldShow,
            ..config.clone()
        };
        assert!(!overlay.apply(show_on_hold.clone()).unwrap().visible);
        assert_eq!(
            unsafe { IsWindowVisible(overlay.window_handle().unwrap() as HWND) },
            0
        );
        show_on_hold.size = 32;
        assert!(!overlay.apply(show_on_hold.clone()).unwrap().visible);
        assert_eq!(
            unsafe { IsWindowVisible(overlay.window_handle().unwrap() as HWND) },
            0
        );
        show_on_hold.hotkey = None;
        assert!(overlay.apply(show_on_hold).unwrap().visible);
        overlay.stop().unwrap();
        assert!(
            !overlay
                .start(Crosshair {
                    hotkey_mode: moligod_core::config::HotkeyMode::HoldShow,
                    ..config
                })
                .unwrap()
                .visible
        );
        overlay.stop().unwrap();
        println!("PASS: hidden toggle -> hold-hide restores visibility; hold-show starts hidden, parameter updates stay hidden, and clearing its key restores visibility.");
        return;
    }
    // Warm up window class registration, then compare native resource counts.
    overlay.start(config.clone()).unwrap();
    overlay.stop().unwrap();
    let before = unsafe { GetGuiResources(GetCurrentProcess(), GR_GDIOBJECTS) };
    for _ in 0..100 {
        let foreground = unsafe { GetForegroundWindow() };
        assert!(overlay.start(config.clone()).unwrap().visible);
        let hwnd = overlay.window_handle().unwrap() as HWND;
        let styles = unsafe { GetWindowLongPtrW(hwnd, GWL_EXSTYLE) } as u32;
        assert_eq!(
            styles & (WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW),
            WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW
        );
        assert_eq!(unsafe { GetForegroundWindow() }, foreground);
        assert!(overlay
            .apply(Crosshair {
                style: CrosshairStyle::Image,
                image_id: None,
                ..config.clone()
            })
            .is_err());
        assert!(overlay.status().running);
        assert_eq!(
            unsafe { SendMessageW(hwnd, WM_NCHITTEST, 0, 0) },
            HTTRANSPARENT as isize
        );
        overlay
            .apply(Crosshair {
                style: CrosshairStyle::Circle,
                ..config.clone()
            })
            .unwrap();
        assert!(!overlay.show(false).unwrap().visible);
        assert!(overlay.show(true).unwrap().visible);
        overlay.stop().unwrap();
        assert_eq!(unsafe { IsWindow(hwnd) }, 0);
    }
    let after = unsafe { GetGuiResources(GetCurrentProcess(), GR_GDIOBJECTS) };
    assert!(after <= before, "GDI leak: {before} -> {after}");
    let displays = moligod_crosshair::monitors().unwrap();
    for display in &displays {
        overlay
            .start(Crosshair {
                monitor: display.id.clone(),
                offset_x: 12,
                offset_y: -10,
                ..config.clone()
            })
            .unwrap();
        let mut rect = unsafe { std::mem::zeroed() };
        unsafe {
            GetWindowRect(overlay.window_handle().unwrap() as HWND, &mut rect);
        }
        assert_eq!(
            (rect.left + rect.right) / 2,
            display.x + display.width / 2 + 12
        );
        assert_eq!(
            (rect.top + rect.bottom) / 2,
            display.y + display.height / 2 - 10
        );
        overlay.stop().unwrap();
    }
    println!(
        "PASS: physical-pixel position on {} connected displays.",
        displays.len()
    );
    overlay
        .start(Crosshair {
            hotkey: Some(65),
            hotkey_mode: moligod_core::config::HotkeyMode::Hold,
            ..config.clone()
        })
        .unwrap();
    overlay.capture(true).unwrap();
    overlay.capture(false).unwrap();
    for key in [1, 2, 4, 5, 6, 65] {
        overlay
            .apply(Crosshair {
                hotkey: Some(key),
                ..config.clone()
            })
            .unwrap();
    }
    overlay.stop().unwrap();
    println!("PASS: arbitrary-key listener start/capture/stop lifecycle.");
    overlay.start(config).unwrap();
    let draws = overlay.status().draw_count;
    std::thread::sleep(Duration::from_secs(2));
    assert_eq!(overlay.status().draw_count, draws, "idle must not redraw");
    overlay.stop().unwrap();
    println!("PASS: 100 start/update/hide/show/stop cycles; no focus theft; transparent hit-test; no GDI growth ({before}->{after}); no idle redraw.");
}
