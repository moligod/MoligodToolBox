//! Isolated real WebView lifecycle test; never loads or runs user tasks.
#[path = "../src/automation_bar.rs"]
mod automation_bar;
use serde_json::json;
use std::time::Duration;
use tauri::Manager;
fn main() {
    let mut context = tauri::generate_context!();
    context.config_mut().identifier = "com.moligod.statusbar.smoke".into();
    tauri::Builder::default()
        .manage(automation_bar::State::default())
        .invoke_handler(tauri::generate_handler![automation_bar::automation_bar_state, automation_bar::dismiss_automation_bar, automation_bar::resize_automation_bar])
        .setup(|app| {
            assert!(app.get_webview_window("automation-status-bar").is_none());
            let handle = app.handle().clone();
            tauri::async_runtime::spawn_blocking(move || {
                let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                automation_bar::prepare(&handle).unwrap();
                let row = json!({"running":true,"phase":"running","step":2,"round":3,"totalSteps":10,"taskName":"状态栏独立验证","ocrModel":"tiny","ocrDevice":"cpu","stopHotkey":"Ctrl + Alt + F10"});
                automation_bar::update(&handle, vec![row.clone()], None);
                std::thread::sleep(Duration::from_secs(2));
                let window = handle.get_webview_window("automation-status-bar").unwrap();
                assert!(window.is_visible().unwrap());
                assert!(window.is_always_on_top().unwrap());
                assert!(!window.is_focused().unwrap());
                let monitor = window.current_monitor().unwrap().unwrap();
                let position = window.outer_position().unwrap();
                let size = window.outer_size().unwrap();
                assert!((size.width as f64) < 1000.0 * monitor.scale_factor(), "short status should shrink");
                println!("HUD monitor position={:?} size={:?} scale={} actual position={position:?} size={size:?}", monitor.position(), monitor.size(), monitor.scale_factor());
                assert!((position.x - monitor.position().x - (monitor.size().width as i32 - size.width as i32)/2).abs() <= 2);
                assert!((position.y - monitor.position().y) < 20);
                println!("PASS: native HUD is topmost, unfocused and centered at monitor top; size={size:?}, position={position:?}");
                let mut next = row.clone(); next["step"] = 3.into();
                next["notice"] = "准备完成，继续执行".into();
                automation_bar::update(&handle, vec![next], None);
                std::thread::sleep(Duration::from_millis(500));
                let short_notice = window.inner_size().unwrap();
                assert!(short_notice.width > size.width, "notice should enlarge the first line");
                assert!(short_notice.height <= size.height + 2, "short notice should remain on one line");
                assert!(!automation_bar::resize_automation_bar(window.clone(), handle.clone(), 1, 250.0, 50.0).unwrap(), "stale layout must not resize the current status");
                let mut long = row.clone(); long["notice"] = "长提示填满屏幕并换行".repeat(80).into();
                automation_bar::update(&handle, vec![long], None);
                std::thread::sleep(Duration::from_millis(500));
                let wrapped = window.inner_size().unwrap();
                assert!(wrapped.width <= monitor.size().width - 24);
                assert!(wrapped.height > short_notice.height, "long notice should wrap");
                // A stale hide request cannot hide a new running revision.
                automation_bar::dismiss_automation_bar(window.clone(), handle.clone(), 1).unwrap();
                assert!(window.is_visible().unwrap());
                let mut done = row; done["running"] = false.into(); done["phase"] = "failed".into(); done["error"] = "已停止任务：独立验证提示".into();
                automation_bar::update(&handle, vec![], Some(done));
                std::thread::sleep(Duration::from_secs(10));
                assert!(!window.is_visible().unwrap(), "WebView must receive state and dismiss the terminal message");
                println!("PASS: stale dismissal rejected; terminal message auto-hidden through real WebView IPC.");
                }));
                if result.is_err() { std::process::exit(1); }
                handle.exit(0);
            });
            Ok(())
        })
        .run(context).expect("HUD smoke app");
}
