use crate::AppState;
use serde_json::{json, Value};
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::{Emitter, Manager};
static NEXT: AtomicU64 = AtomicU64::new(1);
pub struct Session {
    pub label: String,
    pub token: u64,
    pub mode: String,
    pub data: Value,
}
pub(crate) fn close_active(app: &tauri::AppHandle) {
    let old = app
        .state::<AppState>()
        .auxiliary
        .lock()
        .ok()
        .and_then(|mut state| state.take());
    if let Some(old) = old {
        if let Some(window) = app.get_webview_window(&old.label) {
            let _ = window.close();
        }
    }
}
#[tauri::command]
pub fn close_auxiliary(window: tauri::WebviewWindow, app: tauri::AppHandle) -> Result<(), String> {
    crate::tool_windows::tool(&window, "automation")?;
    close_active(&app);
    Ok(())
}
#[tauri::command]
pub async fn open_auxiliary(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    mode: String,
    token: u64,
    payload: Value,
) -> Result<(), String> {
    crate::tool_windows::tool(&window, "automation")?;
    if !["point", "region", "ocr"].contains(&mode.as_str()) {
        return Err("未知子窗口类型".into());
    }
    if !app
        .state::<AppState>()
        .automation_editor
        .load(Ordering::Relaxed)
    {
        return Err("自动化页面已关闭".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        close_active(&app);
        let label = format!("tool-aux-{}", NEXT.fetch_add(1, Ordering::Relaxed));
        let loading = json!({"state":"loading","mode":mode,"token":token});
        *app.state::<AppState>()
            .auxiliary
            .lock()
            .map_err(|_| "子窗口状态锁异常")? = Some(Session {
            label: label.clone(),
            token,
            mode: mode.clone(),
            data: loading,
        });
        let parent = app
            .get_webview_window("tool-automation")
            .ok_or("主窗口不存在")?;
        let child = tauri::WebviewWindowBuilder::new(
            &app,
            &label,
            tauri::WebviewUrl::App("auxiliary.html".into()),
        )
        .title(if mode == "ocr" {
            "OCR 识别结果"
        } else {
            "截图选区"
        })
        .decorations(false)
        .inner_size(
            if mode == "ocr" { 680.0 } else { 1100.0 },
            if mode == "ocr" { 500.0 } else { 760.0 },
        )
        .min_inner_size(420.0, 320.0)
        .owner(&parent)
        .map_err(|e| e.to_string())?
        .build()
        .map_err(|e| e.to_string())?;
        let closed_app = app.clone();
        let closed_label = label.clone();
        child.on_window_event(move |event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                if let Ok(mut state) = closed_app.state::<AppState>().auxiliary.lock() {
                    if state.as_ref().is_some_and(|s| s.label == closed_label) {
                        *state = None;
                    }
                }
            }
        });
        let result = (|| {
            let state = app.state::<AppState>();
            if !state.automation_editor.load(Ordering::Relaxed)
                || state.quitting.load(Ordering::Relaxed)
            {
                return Err("自动化页面已关闭".into());
            }
            let result = state
                .automation
                .lock()
                .map_err(|_| "自动化锁异常")?
                .call(if mode == "ocr" { "ocr-test" } else { "preview" }, payload);
            result
        })();
        let data = match result {
            Ok(result) => json!({"state":"ready","mode":mode,"token":token,"result":result}),
            Err(error) => json!({"state":"error","mode":mode,"token":token,"error":error}),
        };
        let active = {
            let state = app.state::<AppState>();
            let mut guard = state.auxiliary.lock().map_err(|_| "子窗口状态锁异常")?;
            if !state.automation_editor.load(Ordering::Relaxed)
                || state.quitting.load(Ordering::Relaxed)
            {
                if guard.as_ref().is_some_and(|s| s.label == label) {
                    *guard = None;
                }
                false
            } else if let Some(session) = guard.as_mut().filter(|s| s.label == label) {
                session.data = data.clone();
                true
            } else {
                false
            }
        };
        if active {
            let _ = child.emit("auxiliary-state", data);
            let _ = child.show();
            let _ = child.set_focus();
        } else {
            let _ = child.close();
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub fn auxiliary_state(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
) -> Result<Value, String> {
    let state = app.state::<AppState>();
    let guard = state.auxiliary.lock().map_err(|_| "子窗口状态锁异常")?;
    guard
        .as_ref()
        .filter(|s| s.label == window.label())
        .map(|s| s.data.clone())
        .ok_or("子窗口会话已结束".into())
}
fn valid_selection(mode: &str, data: &Value, selection: &Value) -> bool {
    let Some(x) = selection["x"].as_u64() else {
        return false;
    };
    let Some(y) = selection["y"].as_u64() else {
        return false;
    };
    let width = data["result"]["width"].as_u64().unwrap_or(0);
    let height = data["result"]["height"].as_u64().unwrap_or(0);
    if x >= width || y >= height {
        return false;
    }
    if mode == "point" {
        return true;
    }
    mode == "region"
        && selection["width"]
            .as_u64()
            .is_some_and(|w| w > 0 && w <= width - x)
        && selection["height"]
            .as_u64()
            .is_some_and(|h| h > 0 && h <= height - y)
}
#[tauri::command]
pub fn submit_auxiliary(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    selection: Value,
    mode: String,
) -> Result<(), String> {
    let state = app.state::<AppState>();
    let guard = state.auxiliary.lock().map_err(|_| "子窗口状态锁异常")?;
    let session = guard
        .as_ref()
        .filter(|s| s.label == window.label())
        .ok_or("子窗口会话已结束")?;
    if !state.automation_editor.load(Ordering::Relaxed)
        || session.data["state"] != "ready"
        || session.mode != mode
        || !valid_selection(&mode, &session.data, &selection)
    {
        return Err("选区无效或页面已关闭".into());
    }
    let selection = if mode == "point" {
        json!({"x":selection["x"],"y":selection["y"]})
    } else {
        json!({"x":selection["x"],"y":selection["y"],"width":selection["width"],"height":selection["height"]})
    };
    app.emit_to(
        "tool-automation",
        "automation-selection",
        json!({"token":session.token,"mode":mode,"selection":selection}),
    )
    .map_err(|e| e.to_string())?;
    drop(guard);
    window.close().map_err(|e| e.to_string())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn selections_are_bounded_and_ocr_cannot_submit() {
        let data = json!({"result":{"width":800,"height":600}});
        assert!(valid_selection(
            "region",
            &data,
            &json!({"x":1,"y":2,"width":799,"height":598})
        ));
        assert!(!valid_selection(
            "region",
            &data,
            &json!({"x":1,"y":2,"width":800,"height":598})
        ));
        assert!(!valid_selection("ocr", &data, &json!({"x":1,"y":2})));
        assert!(!valid_selection("point", &data, &json!({"x":-1,"y":2})));
    }
}
