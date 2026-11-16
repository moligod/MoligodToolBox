use std::sync::Mutex;
use tauri::{Emitter, Manager, PhysicalPosition, PhysicalSize};

#[derive(Default)]
pub struct State(Mutex<Layout>);
#[derive(Default)]
struct Layout {
    expanded: bool,
    hover_running: bool,
    docked_position: Option<PhysicalPosition<i32>>,
    drag: Option<(PhysicalPosition<i32>, tauri::PhysicalPosition<f64>)>,
    compact_position: Option<PhysicalPosition<i32>>,
}

fn dockable(y: i32, top: i32, scale: f64) -> bool {
    (i64::from(y) - i64::from(top)).abs() <= (8.0 * scale) as i64
}

pub fn restore(window: &tauri::WebviewWindow) -> Result<(), String> {
    let state = window.state::<State>();
    let mut layout = state.0.lock().map_err(|_| "窗口布局锁异常")?;
    if let Some(position) = layout.docked_position {
        window.set_position(position).map_err(|e| e.to_string())?;
        window.set_resizable(true).map_err(|e| e.to_string())?;
        window.set_always_on_top(false).map_err(|e| e.to_string())?;
        layout.docked_position = None;
    }
    Ok(())
}

fn expand(window: tauri::WebviewWindow, expanded: bool) -> Result<(), String> {
    crate::main_window(&window)?;
    restore(&window)?;
    let state = window.state::<State>();
    let mut layout = state.0.lock().map_err(|_| "窗口布局锁异常")?;
    if layout.expanded == expanded {
        return Ok(());
    }
    if expanded {
        layout.compact_position = Some(window.outer_position().map_err(|e| e.to_string())?);
    }
    window.unmaximize().map_err(|e| e.to_string())?;
    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or("无法读取屏幕")?;
    let area = monitor.work_area();
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let width =
        ((if expanded { 1600.0 } else { 340.0 }) * scale).min(f64::from(area.size.width)) as u32;
    let height =
        ((if expanded { 900.0 } else { 720.0 }) * scale).min(f64::from(area.size.height)) as u32;
    window
        .set_min_size(Some(tauri::LogicalSize::new(
            if expanded { 760.0 } else { 300.0 },
            360.0,
        )))
        .map_err(|e| e.to_string())?;
    window
        .set_size(PhysicalSize::new(width, height))
        .map_err(|e| e.to_string())?;
    let position = if expanded {
        window.outer_position().map_err(|e| e.to_string())?
    } else {
        layout.compact_position.unwrap_or(area.position)
    };
    window
        .set_position(PhysicalPosition::new(
            position.x.clamp(
                area.position.x,
                area.position.x + area.size.width.saturating_sub(width) as i32,
            ),
            position.y.clamp(
                area.position.y,
                area.position.y + area.size.height.saturating_sub(height) as i32,
            ),
        ))
        .map_err(|e| e.to_string())?;
    layout.expanded = expanded;
    Ok(())
}

#[tauri::command]
pub async fn set_toolbox_expanded(
    window: tauri::WebviewWindow,
    expanded: bool,
) -> Result<(), String> {
    crate::main_window(&window)?;
    tauri::async_runtime::spawn_blocking(move || expand(window, expanded))
        .await
        .map_err(|e| e.to_string())?
}

// Runs only during the short user-requested transition, never on the UI thread.
fn slide(window: &tauri::WebviewWindow, target: PhysicalPosition<i32>) -> Result<(), String> {
    let from = window.outer_position().map_err(|e| e.to_string())?;
    for frame in 1..=18 {
        let eased = slide_progress(frame);
        window
            .set_position(PhysicalPosition::new(
                target.x,
                (f64::from(from.y) + f64::from(target.y - from.y) * eased).round() as i32,
            ))
            .map_err(|e| e.to_string())?;
        std::thread::sleep(std::time::Duration::from_millis(15));
    }
    Ok(())
}

fn dock(window: &tauri::WebviewWindow, collapse: bool, released: bool) -> Result<bool, String> {
    let state = window.state::<State>();
    let mut layout = state.0.lock().map_err(|_| "窗口布局锁异常")?;
    if !collapse {
        if let Some(position) = layout.docked_position {
            slide(window, position)?;
            window.set_resizable(true).map_err(|e| e.to_string())?;
            window.set_always_on_top(false).map_err(|e| e.to_string())?;
            layout.docked_position = None;
        }
        return Ok(false);
    }
    if layout.docked_position.is_some() {
        return Ok(true);
    }
    if layout.expanded
        || layout.drag.is_some()
        || window.is_maximized().map_err(|e| e.to_string())?
        || window.is_minimized().map_err(|e| e.to_string())?
    {
        return Ok(false);
    }
    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or("无法读取屏幕")?;
    let position = window.outer_position().map_err(|e| e.to_string())?;
    let size = window.outer_size().map_err(|e| e.to_string())?;
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let cursor = window.cursor_position().map_err(|e| e.to_string())?;
    let inside = cursor.x >= f64::from(position.x)
        && cursor.x < f64::from(position.x) + f64::from(size.width)
        && cursor.y >= f64::from(position.y)
        && cursor.y < f64::from(position.y) + f64::from(size.height);
    let top = monitor.position().y;
    if (!released && inside) || !dockable(position.y, top, scale) {
        return Ok(false);
    }
    let visible = PhysicalPosition::new(position.x, top);
    let (hidden, _) = hidden_geometry(visible, size, (2.0 * scale).max(2.0) as u32);
    window.set_always_on_top(true).map_err(|e| e.to_string())?;
    // Record the recovery position before moving, including partial animation failures.
    layout.docked_position = Some(visible);
    window.set_resizable(false).map_err(|e| e.to_string())?;
    slide(window, hidden)?;
    drop(layout);
    watch_top_hover(window)?;
    Ok(true)
}

fn slide_progress(frame: u32) -> f64 {
    let t = f64::from(frame.min(18)) / 18.0;
    t * t * (3.0 - 2.0 * t)
}

fn top_hover(
    cursor: PhysicalPosition<f64>,
    position: PhysicalPosition<i32>,
    width: u32,
    scale: f64,
) -> bool {
    cursor.x >= f64::from(position.x)
        && cursor.x < f64::from(position.x) + f64::from(width)
        && cursor.y >= f64::from(position.y)
        && cursor.y < f64::from(position.y) + (4.0 * scale).max(2.0)
}

// WebView mouseenter is not reliable over the non-client edge of an unfocused,
// almost entirely off-screen window. Read the native cursor only while hidden.
fn watch_top_hover(window: &tauri::WebviewWindow) -> Result<(), String> {
    let state = window.state::<State>();
    let mut layout = state.0.lock().map_err(|_| "窗口布局锁异常")?;
    if layout.hover_running {
        return Ok(());
    }
    let initial_cursor = window.cursor_position().map_err(|e| e.to_string())?;
    let width = window.outer_size().map_err(|e| e.to_string())?.width;
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let mut armed = !layout
        .docked_position
        .is_some_and(|position| top_hover(initial_cursor, position, width, scale));
    layout.hover_running = true;
    let window = window.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let result = (|| -> Result<(), String> {
            loop {
                std::thread::sleep(std::time::Duration::from_millis(32));
                let state = window.state::<State>();
                let mut layout = state.0.lock().map_err(|_| "窗口布局锁异常")?;
                let Some(position) = layout.docked_position else {
                    layout.hover_running = false;
                    return Ok(());
                };
                if !window.is_visible().map_err(|e| e.to_string())?
                    || window.is_minimized().map_err(|e| e.to_string())?
                {
                    layout.hover_running = false;
                    return Ok(());
                }
                let cursor = window.cursor_position().map_err(|e| e.to_string())?;
                let width = window.outer_size().map_err(|e| e.to_string())?.width;
                let scale = window.scale_factor().map_err(|e| e.to_string())?;
                let touching = top_hover(cursor, position, width, scale);
                if !touching {
                    armed = true;
                }
                if armed && touching {
                    // Keep the same lock for the entire transition. DOM mouseenter
                    // cannot race this into a second restore or skip the animation.
                    slide(&window, position)?;
                    window.set_resizable(true).map_err(|e| e.to_string())?;
                    window.set_always_on_top(false).map_err(|e| e.to_string())?;
                    layout.docked_position = None;
                    layout.hover_running = false;
                    return Ok(());
                }
            }
        })();
        if let Err(error) = result {
            if let Ok(mut layout) = window.state::<State>().0.lock() {
                layout.hover_running = false;
            }
            eprintln!("Top-edge hover failed: {error}");
            let _ = window.emit("toolbox-window-error", error);
        }
    });
    Ok(())
}

#[tauri::command]
pub async fn toolbox_dock(window: tauri::WebviewWindow, collapse: bool) -> Result<bool, String> {
    crate::main_window(&window)?;
    tauri::async_runtime::spawn_blocking(move || dock(&window, collapse, false))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn toolbox_drag(window: tauri::WebviewWindow, phase: String) -> Result<bool, String> {
    crate::main_window(&window)?;
    tauri::async_runtime::spawn_blocking(move || {
        let state = window.state::<State>();
        let mut layout = state.0.lock().map_err(|_| "窗口布局锁异常")?;
        if layout.expanded {
            return Err("展开模式使用系统拖动".into());
        }
        match phase.as_str() {
            "start" => {
                if layout.docked_position.is_some() {
                    return Err("请先展开工具列表".into());
                }
                layout.drag = Some((
                    window.outer_position().map_err(|e| e.to_string())?,
                    window.cursor_position().map_err(|e| e.to_string())?,
                ));
            }
            "move" | "end" => {
                if let Some((origin, anchor)) = layout.drag {
                    let cursor = window.cursor_position().map_err(|e| e.to_string())?;
                    let monitor = window
                        .available_monitors()
                        .map_err(|e| e.to_string())?
                        .into_iter()
                        .find(|m| {
                            cursor.x >= f64::from(m.position().x)
                                && cursor.x < f64::from(m.position().x) + f64::from(m.size().width)
                                && cursor.y >= f64::from(m.position().y)
                                && cursor.y < f64::from(m.position().y) + f64::from(m.size().height)
                        })
                        .ok_or("光标不在可用屏幕内")?;
                    let y = (f64::from(origin.y) + cursor.y - anchor.y).round() as i32;
                    window
                        .set_position(PhysicalPosition::new(
                            (f64::from(origin.x) + cursor.x - anchor.x).round() as i32,
                            y.max(monitor.position().y),
                        ))
                        .map_err(|e| e.to_string())?;
                }
                if phase == "end" {
                    layout.drag = None;
                    drop(layout);
                    return dock(&window, true, true);
                }
            }
            "cancel" => {
                layout.drag = None;
            }
            _ => return Err("未知拖动操作".into()),
        }
        Ok(false)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn top_edge_uses_monitor_origin_and_dpi() {
        assert!(dockable(0, 0, 1.0));
        assert!(dockable(-1430, -1440, 1.5));
        assert!(!dockable(18, 0, 1.0));
        assert!(!dockable(-1200, -1440, 1.5));
    }
}

#[cfg(test)]
mod slide_regression {
    use super::*;
    #[test]
    fn hiding_moves_whole_window_above_screen_without_resizing() {
        let position = PhysicalPosition::new(500, -1440);
        let size = PhysicalSize::new(425, 900);
        let (hidden, unchanged) = hidden_geometry(position, size, 3);
        assert_eq!(unchanged, size);
        assert_eq!(hidden, PhysicalPosition::new(500, -2337));
    }
}
fn hidden_geometry(
    position: PhysicalPosition<i32>,
    size: PhysicalSize<u32>,
    strip: u32,
) -> (PhysicalPosition<i32>, PhysicalSize<u32>) {
    (
        PhysicalPosition::new(position.x, position.y - size.height as i32 + strip as i32),
        size,
    )
}

#[cfg(test)]
mod hover_tests {
    use super::*;
    #[test]
    fn hovering_top_edge_needs_no_click_or_focus_and_respects_monitor_bounds() {
        let visible = PhysicalPosition::new(-800, -1440);
        assert!(top_hover(
            PhysicalPosition::new(-700.0, -1440.0),
            visible,
            425,
            1.25
        ));
        assert!(!top_hover(
            PhysicalPosition::new(-375.0, -1440.0),
            visible,
            425,
            1.25
        ));
        assert!(!top_hover(
            PhysicalPosition::new(-700.0, -1430.0),
            visible,
            425,
            1.25
        ));
    }
    #[test]
    fn slide_out_has_visible_intermediate_frames_and_reaches_exact_destination() {
        assert_eq!(slide_progress(0), 0.0);
        assert_eq!(slide_progress(9), 0.5);
        assert_eq!(slide_progress(18), 1.0);
        for frame in 1..=18 {
            assert!(slide_progress(frame) > slide_progress(frame - 1));
        }
    }
}
