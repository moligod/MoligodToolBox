use tauri::{Emitter, Manager};

pub fn is_editor(label: &str) -> bool {
    matches!(label, "tool-crosshair" | "tool-automation")
}
pub fn editor(window: &tauri::WebviewWindow) -> Result<(), String> {
    if window.label() == "main" || is_editor(window.label()) {
        Ok(())
    } else {
        Err("窗口无权执行此操作".into())
    }
}
pub fn tool(window: &tauri::WebviewWindow, name: &str) -> Result<(), String> {
    if window.label() == "main" || window.label() == format!("tool-{name}") {
        Ok(())
    } else {
        Err("窗口无权操作此工具".into())
    }
}
/// Tool windows hide instead of closing; tell the page so it can release or reopen modules.
pub fn notify_visibility<R: tauri::Runtime>(emitter: &impl Emitter<R>, label: &str, visible: bool) {
    let _ = emitter.emit_to(
        label,
        "tool-window-visibility",
        serde_json::json!({ "label": label, "visible": visible }),
    );
}
#[tauri::command]
pub async fn open_tool_window(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    tool: String,
) -> Result<(), String> {
    editor(&window)?;
    let (label, title, width, height) = match tool.as_str() {
        "crosshair" => ("tool-crosshair", "自定义准星", 1100.0, 740.0),
        "automation" => ("tool-automation", "自动化助手", 1440.0, 900.0),
        _ => return Err("未知工具窗口".into()),
    };
    // One UI-thread transaction prevents rapid repeated clicks from creating duplicates.
    let handle = app.clone();
    app.run_on_main_thread(move || {
        let result = (|| -> tauri::Result<()> {
            let target = if let Some(target) = handle.get_webview_window(label) {
                target
            } else {
                tauri::WebviewWindowBuilder::new(
                    &handle,
                    label,
                    tauri::WebviewUrl::App("index.html".into()),
                )
                .title(title)
                .decorations(false)
                .inner_size(width, height)
                .min_inner_size(760.0, 480.0)
                .center()
                .build()?
            };
            target.show()?;
            target.unminimize()?;
            target.set_focus()?;
            notify_visibility(&target, label, true);
            Ok(())
        })();
        if let Err(error) = result {
            let _ = window.emit("toolbox-window-error", error.to_string());
        }
    })
    .map_err(|e| e.to_string())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn editor_labels_are_exact_and_exclude_auxiliary_windows() {
        assert!(is_editor("tool-crosshair"));
        assert!(is_editor("tool-automation"));
        assert!(!is_editor("tool-settings"));
        assert!(!is_editor("tool-aux-1"));
        assert!(!is_editor("tool-unknown"));
    }
}

pub fn merge_config(
    label: &str,
    mut current: moligod_core::config::Config,
    incoming: moligod_core::config::Config,
) -> Result<moligod_core::config::Config, String> {
    match label {
        "tool-crosshair" => current.crosshair = incoming.crosshair,
        "main" => current.close_to_tray = incoming.close_to_tray,
        _ => return Err("此窗口不能保存设置".into()),
    }
    Ok(current)
}
#[cfg(test)]
mod config_tests {
    use super::*;
    use moligod_core::config::Config;
    #[test]
    fn stale_editor_snapshots_do_not_overwrite_other_window_settings() {
        let live = Config {
            close_to_tray: true,
            ..Config::default()
        };
        let mut draft = Config::default();
        draft.crosshair.size = 40;
        let saved = merge_config("tool-crosshair", live, draft).unwrap();
        assert!(saved.close_to_tray);
        assert_eq!(saved.crosshair.size, 40);
        let saved = merge_config("main", saved, Config::default()).unwrap();
        assert!(!saved.close_to_tray);
        assert_eq!(saved.crosshair.size, 40);
        assert!(merge_config("tool-automation", saved, Config::default()).is_err());
    }
}
