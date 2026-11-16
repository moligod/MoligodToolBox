//! Passive, event-driven execution HUD. No engine access or background polling.
use serde::Serialize;
use serde_json::Value;
use std::sync::Mutex;
use tauri::{Emitter, Manager};

const LABEL: &str = "automation-status-bar";
#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    revision: u64,
    rows: Vec<Value>,
    max_width: f64,
}
#[derive(Default)]
pub struct State(Mutex<Snapshot>);

pub fn prepare(app: &tauri::AppHandle) -> Result<(), String> {
    let existing = app.get_webview_window(LABEL);
    let is_new = existing.is_none();
    let window = if let Some(window) = existing {
        window
    } else {
        tauri::WebviewWindowBuilder::new(
            app,
            LABEL,
            tauri::WebviewUrl::App("automation-bar.html".into()),
        )
        .title("任务状态")
        .decorations(false)
        .resizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .focused(false)
        .focusable(false)
        .visible(false)
        .inner_size(1000.0, 52.0)
        .build()
        .map_err(|e| e.to_string())?
    };
    window
        .set_ignore_cursor_events(true)
        .map_err(|e| e.to_string())?;
    if let Some(monitor) = app
        .get_webview_window("main")
        .and_then(|w| w.current_monitor().ok().flatten())
        .or_else(|| window.primary_monitor().ok().flatten())
    {
        let scale = monitor.scale_factor();
        let max_width = ((f64::from(monitor.size().width) - 24.0).max(1.0) / scale).max(1.0);
        app.state::<State>()
            .0
            .lock()
            .map_err(|_| "状态锁异常")?
            .max_width = max_width;
        let width = (1000.0_f64 * scale)
            .min(f64::from(monitor.size().width) - 24.0)
            .max(240.0) as u32;
        if is_new {
            window
                .set_size(tauri::PhysicalSize::new(width, (52.0 * scale) as u32))
                .map_err(|e| e.to_string())?;
        }
        let outer_width = window.outer_size().map_err(|e| e.to_string())?.width;
        window
            .set_position(tauri::PhysicalPosition::new(
                monitor.position().x + (monitor.size().width as i32 - outer_width as i32) / 2,
                monitor.position().y + (4.0 * scale) as i32,
            ))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn update(app: &tauri::AppHandle, mut rows: Vec<Value>, latest: Option<Value>) {
    if rows.is_empty() {
        if let Some(last) = latest.filter(|v| v["phase"] != "idle") {
            rows.push(last);
        }
    }
    let bar = app.state::<State>();
    let Ok(mut snapshot) = bar.0.lock() else {
        return;
    };
    snapshot.revision += 1;
    snapshot.rows = rows;
    let current = snapshot.clone();
    // Queue native UI operations in order; the authoritative snapshot remains readable on load.
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        if let Some(window) = handle.get_webview_window(LABEL) {
            if current.rows.is_empty() {
                let _ = window.hide();
            } else {
                let _ = window.show();
            }
            let _ = window.emit("automation-bar-state", &current);
        }
    });
}

#[tauri::command]
pub fn resize_automation_bar(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    revision: u64,
    width: f64,
    height: f64,
) -> Result<bool, String> {
    if window.label() != LABEL {
        return Err("窗口无权执行此操作".into());
    }
    if !width.is_finite() || !height.is_finite() || width <= 0.0 || height <= 0.0 {
        return Err("状态栏尺寸无效".into());
    }
    let state = app.state::<State>();
    let snapshot = state.0.lock().map_err(|_| "状态锁异常")?;
    if snapshot.revision != revision || snapshot.rows.is_empty() {
        return Ok(false);
    }
    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .or_else(|| window.primary_monitor().ok().flatten())
        .ok_or("找不到状态栏所在屏幕")?;
    let scale = monitor.scale_factor();
    let max_width = (f64::from(monitor.size().width) - 24.0).max(1.0);
    let max_height = (f64::from(monitor.size().height) - 8.0 * scale).max(1.0);
    let width = (width * scale).ceil().clamp(1.0, max_width) as u32;
    let height = (height * scale).ceil().clamp(1.0, max_height) as u32;
    window
        .set_size(tauri::PhysicalSize::new(width, height))
        .map_err(|e| e.to_string())?;
    let outer_width = window.outer_size().map_err(|e| e.to_string())?.width;
    window
        .set_position(tauri::PhysicalPosition::new(
            monitor.position().x + (monitor.size().width as i32 - outer_width as i32) / 2,
            monitor.position().y + (4.0 * scale) as i32,
        ))
        .map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub fn automation_bar_state(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
) -> Result<Snapshot, String> {
    if window.label() != LABEL {
        return Err("窗口无权执行此操作".into());
    }
    app.state::<State>()
        .0
        .lock()
        .map(|v| v.clone())
        .map_err(|_| "状态锁异常".into())
}
#[tauri::command]
pub fn dismiss_automation_bar(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    revision: u64,
) -> Result<(), String> {
    if window.label() != LABEL {
        return Err("窗口无权执行此操作".into());
    }
    let state = app.state::<State>();
    let snapshot = state.0.lock().map_err(|_| "状态锁异常")?;
    if snapshot.revision == revision && snapshot.rows.iter().all(|v| v["running"] != true) {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}
