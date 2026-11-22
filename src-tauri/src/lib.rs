mod automation_bar;
mod auxiliary;
mod capture_directory;
mod game_library;
mod github;
#[cfg(any(protected_install, test))]
mod install_location;
mod tool_windows;
mod toolbox_window;
use base64::{engine::general_purpose::STANDARD, Engine};
use moligod_core::config::{Config, Crosshair};
use moligod_core::crosshair_state::{Monitor, Status as CrosshairStatus};
use moligod_module_host::{ModuleClient, ModuleInfo};
use moligod_storage::{game_library::GameLibraryStore, ConfigStore};
use serde::Serialize;
use serde_json::Value;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};
use tauri_plugin_opener::OpenerExt;

struct AppState {
    auxiliary: Mutex<Option<auxiliary::Session>>,
    store: Mutex<ConfigStore>,
    game_library: Mutex<GameLibraryStore>,
    crosshair: Mutex<ModuleClient>,
    crosshair_status: Arc<Mutex<CrosshairStatus>>,
    crosshair_editor: AtomicBool,
    automation: Mutex<ModuleClient>,
    automation_status: Arc<Mutex<Value>>,
    automation_task_status: Arc<Mutex<Value>>,
    automation_editor: AtomicBool,
    quitting: AtomicBool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Bootstrap {
    version: &'static str,
    config: Config,
    crosshair_status: CrosshairStatus,
    modules: Vec<ModuleInfo>,
}

fn main_window(window: &tauri::WebviewWindow) -> Result<(), String> {
    if window.label() != "main" {
        return Err("窗口无权执行此操作".into());
    }
    Ok(())
}

#[tauri::command]
async fn bootstrap(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
) -> Result<Bootstrap, String> {
    tool_windows::editor(&window)?;
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let store = state.store.lock().map_err(|_| "配置锁异常")?;
        let config = store.load()?;
        let crosshair_status = state
            .crosshair_status
            .lock()
            .map_err(|_| "准星状态锁异常")?
            .clone();
        let modules = vec![
            state.crosshair.lock().map_err(|_| "准星锁异常")?.info(),
            state.automation.lock().map_err(|_| "自动化锁异常")?.info(),
        ];
        Ok(Bootstrap {
            version: env!("CARGO_PKG_VERSION"),
            config,
            crosshair_status,
            modules,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn save_config(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    config: Config,
) -> Result<Config, String> {
    tool_windows::editor(&window)?;
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        // Keep configuration writes serialized off the UI thread.
        let store = state.store.lock().map_err(|_| "配置锁异常")?;
        let config = tool_windows::merge_config(window.label(), store.load()?, config)?;
        store.save(&config)?;
        Ok(config)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn show_main(app: &tauri::AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        if let Some(window) = app.get_webview_window("main") {
            let _ = toolbox_window::restore(&window);
            let _ = window.emit("toolbox-restored", ());
            if let Err(error) = window
                .show()
                .and_then(|_| window.unminimize())
                .and_then(|_| window.set_focus())
            {
                eprintln!("Cannot show main window: {error}");
            }
        }
    });
}

#[tauri::command]
async fn crosshair_action(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    action: String,
    config: Option<Crosshair>,
) -> Result<CrosshairStatus, String> {
    tool_windows::tool(&window, "crosshair")?;
    if action == "open" {
        app.state::<AppState>()
            .crosshair_editor
            .store(true, Ordering::Relaxed);
    }
    if action == "release" {
        app.state::<AppState>()
            .crosshair_editor
            .store(false, Ordering::Relaxed);
    }
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        if state.quitting.load(Ordering::Relaxed) {
            return Err("客户端正在退出".into());
        }
        let mut module = state.crosshair.lock().map_err(|_| "准星锁异常")?;
        if state.quitting.load(Ordering::Relaxed) {
            return Err("客户端正在退出".into());
        }
        if action == "status" {
            return Ok(state
                .crosshair_status
                .lock()
                .map_err(|_| "准星状态锁异常")?
                .clone());
        }
        if action == "release" {
            if !state
                .crosshair_status
                .lock()
                .map_err(|_| "准星状态锁异常")?
                .running
            {
                module.shutdown();
            }
            return Ok(state
                .crosshair_status
                .lock()
                .map_err(|_| "准星状态锁异常")?
                .clone());
        }
        if action == "stop" {
            module.shutdown();
            return Ok(CrosshairStatus::default());
        }
        if action == "open" && !state.crosshair_editor.load(Ordering::Relaxed) {
            return Err("准星设置已关闭".into());
        }
        if ![
            "start",
            "test-action",
            "apply",
            "show",
            "hide",
            "capture-on",
            "capture-off",
            "open",
        ]
        .contains(&action.as_str())
        {
            return Err("未知准星操作".into());
        }
        if action.starts_with("capture-") && !module.is_started() {
            return Ok(CrosshairStatus::default());
        }
        let payload = if ["start", "apply"].contains(&action.as_str()) {
            serde_json::to_value(config.ok_or("缺少准星参数")?).map_err(|e| e.to_string())?
        } else {
            Value::Null
        };
        let value = module.call(if action == "open" { "status" } else { &action }, payload)?;
        serde_json::from_value(value).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

fn crosshair_query(state: &AppState, method: &str, payload: Value) -> Result<Value, String> {
    let mut module = state.crosshair.lock().map_err(|_| "准星锁异常")?;
    if !state.crosshair_editor.load(Ordering::Relaxed) || state.quitting.load(Ordering::Relaxed) {
        return Err("准星设置已关闭".into());
    }
    module.call(method, payload)
}
#[tauri::command]
async fn crosshair_monitors(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
) -> Result<Vec<Monitor>, String> {
    tool_windows::tool(&window, "crosshair")?;
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let value = crosshair_query(&state, "monitors", Value::Null)?;
        serde_json::from_value(value).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn import_crosshair_image(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    bytes: Vec<u8>,
) -> Result<String, String> {
    tool_windows::tool(&window, "crosshair")?;
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        if bytes.len() > 8 * 1024 * 1024 {
            return Err("图片不能超过 8 MiB".into());
        }
        let value = crosshair_query(
            &state,
            "import-image",
            Value::String(STANDARD.encode(bytes)),
        )?;
        serde_json::from_value(value).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn crosshair_image_preview(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    image_id: String,
) -> Result<Vec<u8>, String> {
    tool_windows::tool(&window, "crosshair")?;
    if image_id.len() != 64 || !image_id.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err("图片标识无效".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let value = crosshair_query(&state, "image-preview", Value::String(image_id))?;
        STANDARD
            .decode(value.as_str().ok_or("模块图片响应无效")?)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

fn request_exit(app: tauri::AppHandle) {
    if app
        .state::<AppState>()
        .quitting
        .swap(true, Ordering::Relaxed)
    {
        return;
    }
    tauri::async_runtime::spawn_blocking(move || {
        stop_tools(&app);
        app.exit(0);
    });
}

fn stop_tools(app: &tauri::AppHandle) {
    if let Ok(mut overlay) = app.state::<AppState>().crosshair.lock() {
        overlay.shutdown();
    }
    if let Ok(mut automation) = app.state::<AppState>().automation.lock() {
        automation.shutdown();
    }
}

#[tauri::command]
async fn automation_action(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    action: String,
    payload: Value,
) -> Result<Value, String> {
    tool_windows::tool(&window, "automation")?;
    if action == "open" {
        app.state::<AppState>()
            .automation_editor
            .store(true, Ordering::Relaxed);
    }
    if action == "release" {
        app.state::<AppState>()
            .automation_editor
            .store(false, Ordering::Relaxed);
    }
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        if state.quitting.load(Ordering::Relaxed) {
            return Err("客户端正在退出".into());
        }
        let mut module = state.automation.lock().map_err(|_| "自动化锁异常")?;
        if action == "status" {
            return Ok(state
                .automation_status
                .lock()
                .map_err(|_| "自动化状态锁异常")?
                .clone());
        }
        if action == "release" {
            let legacy_running = state
                .automation_status
                .lock()
                .map_err(|_| "自动化状态锁异常")?["running"]
                .as_bool()
                .unwrap_or(false);
            let tasks_running = state
                .automation_task_status
                .lock()
                .map_err(|_| "任务状态锁异常")?
                .as_object()
                .is_some_and(|rows| rows.values().any(|row| row["running"] == true));
            if !legacy_running && !tasks_running {
                module.shutdown();
            } else if module.is_started() {
                // Running tasks keep the module alive; drop only the editor's preview frame
                // and kept OCR worker. Older modules reject the call, which changes nothing.
                let _ = module.call("release-editor", Value::Null);
            }
            return Ok(Value::Null);
        }
        if action == "stop" && !module.is_started() {
            return Ok(state
                .automation_status
                .lock()
                .map_err(|_| "自动化状态锁异常")?
                .clone());
        }
        if action != "stop" && !state.automation_editor.load(Ordering::Relaxed) {
            return Err("自动化设置已关闭".into());
        }
        if action == "open" {
            return module.call("status", Value::Null);
        }
        if ![
            "windows",
            "window-metrics",
            "validate",
            "start",
            "test-action",
            "stop",
            "save",
            "list",
            "load",
            "preview",
            "ocr-test",
            "ocr-settings",
            "ocr-settings-save",
            "hotkey-settings",
            "hotkey-settings-save",
            "pick-point",
            "import-template",
            "template-image",
            "task-save",
            "task-list",
            "component-list",
            "component-import",
            "component-add",
            "component-remove",
            "component-rename",
            "component-move",
            "task-reorder",
            "task-load",
            "task-delete",
            "task-statuses",
            "task-start",
            "task-stop",
            "task-stop-all",
        ]
        .contains(&action.as_str())
        {
            return Err("未知自动化操作".into());
        }
        if matches!(action.as_str(), "start" | "task-start" | "test-action") {
            automation_bar::prepare(&app)?;
            // The user's Run click belongs to the host, not the engine process.
            // Ensure a child exists before granting that exact PID permission.
            module.call("status", Value::Null)?;
            if !module.allow_foreground() {
                eprintln!("Windows declined automation foreground permission transfer");
            }
        }
        let archived = (action == "task-delete")
            .then(|| payload.as_str().map(str::to_owned))
            .flatten();
        let result = module.call(&action, payload);
        // Capturing activates the target; return the user to the window that asked for the
        // picker/result. A hidden toolbox or editor stays hidden.
        if matches!(action.as_str(), "preview" | "ocr-test")
            && state.automation_editor.load(Ordering::Relaxed)
            && !state.quitting.load(Ordering::Relaxed)
            && window.is_visible().unwrap_or(false)
        {
            if let Err(error) = window.unminimize().and_then(|_| window.set_focus()) {
                eprintln!("Cannot refocus automation window: {error}");
            }
        }
        let result = result?;
        if let Some(id) = archived {
            // The module joined the runner before replying, so its final state event has
            // already been cached; dropping it now cannot be undone by a late event.
            if let Some(rows) = state
                .automation_task_status
                .lock()
                .map_err(|_| "任务状态锁异常")?
                .as_object_mut()
            {
                rows.remove(&id);
            }
        }
        if action == "stop" {
            let tasks_running = state
                .automation_task_status
                .lock()
                .map_err(|_| "任务状态锁异常")?
                .as_object()
                .is_some_and(|rows| rows.values().any(|row| row["running"] == true));
            if !tasks_running {
                module.shutdown();
            }
        }
        Ok(result)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn website_url(site: &str) -> Result<&'static str, String> {
    match site {
        "guide" => Ok("https://moligod.com"),
        "blog" => Ok("https://moligod.cn"),
        "trove" => Ok("https://trovebbs.com"),
        _ => Err("未知网站入口".into()),
    }
}
#[tauri::command]
async fn open_website(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    site: String,
) -> Result<(), String> {
    main_window(&window)?;
    let url = website_url(&site)?;
    tauri::async_runtime::spawn_blocking(move || {
        app.opener()
            .open_url(url, None::<&str>)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}
#[cfg(test)]
mod website_tests {
    use super::*;
    #[test]
    fn website_links_only_allow_the_three_named_destinations() {
        assert_eq!(website_url("guide").unwrap(), "https://moligod.com");
        assert_eq!(website_url("blog").unwrap(), "https://moligod.cn");
        assert_eq!(website_url("trove").unwrap(), "https://trovebbs.com");
        assert!(website_url("https://example.com").is_err());
        assert!(website_url("file:///C:/Windows").is_err());
    }
}

#[tauri::command]
async fn open_delta_guide(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
) -> Result<(), String> {
    main_window(&window)?;
    tauri::async_runtime::spawn_blocking(move || {
        app.opener()
            .open_url("https://moligod.com", None::<&str>)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

pub fn run() {
    #[cfg(protected_install)]
    let Some(release_modules) = install_location::release_modules() else {
        install_location::show_install_required();
        return;
    };
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_opener::Builder::new()
                .open_js_links_on_click(false)
                .build(),
        )
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            show_main(app)
        }))
        .setup(move |app| {
            app.manage(github::State::default());
            app.manage(toolbox_window::State::default());
            // Compact launcher; tools expand this same window on demand.
            let main = app.get_webview_window("main").ok_or("Missing main window")?;
            let size = tauri::LogicalSize::new(340.0, 720.0);
            main.set_min_size(Some(tauri::LogicalSize::new(300.0, 360.0)))?;
            main.set_size(size)?;
            main.center()?;
            main.show()?;
            let directory = app.path().app_config_dir()?;
            let store = ConfigStore::new(&directory);
            let game_library = GameLibraryStore::new(&app.path().app_data_dir()?);
            let image_directory = directory.join("crosshair-images");
            #[cfg(not(protected_install))]
            let (bundled, installed) = (
                std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../bundled-modules/dev"),
                Some(app.path().app_local_data_dir()?.join("modules")),
            );
            #[cfg(protected_install)]
            let (bundled, installed): (_, Option<std::path::PathBuf>) = (release_modules, None);
            let automation_status=Arc::new(Mutex::new(serde_json::json!({"running":false,"phase":"idle","step":0,"executed":0,"error":null,"variables":{},"logs":[],"revision":0})));
            let automation_task_status=Arc::new(Mutex::new(serde_json::json!({})));
            let cached_tasks=automation_task_status.clone();
            let cached_auto=automation_status.clone();let handle_auto=app.handle().clone();
            app.manage(automation_bar::State::default());
            let automation=ModuleClient::new("automation",bundled.join("automation"),installed.as_ref().map(|path| path.join("automation")),directory.join("automation"),move|name,mut data|{
                if name=="automation-task-state" {
                    if let (Some(id),Some(status))=(data["taskId"].as_str(),data.get("status")) {
                        if let Ok(mut cached)=cached_tasks.lock() { cached[id]=status.clone(); }
                    }
                    let _=handle_auto.emit("automation-task-state",&data);
                }
                if name=="module-disconnected" {
                    if let Ok(mut tasks)=cached_tasks.lock() {
                        if let Some(rows)=tasks.as_object_mut() {
                            for (id,status) in rows.iter_mut() {
                                if status["running"]==true {
                                    status["running"]=false.into(); status["phase"]="failed".into();
                                    status["error"]="自动化模块意外退出".into();
                                    let _=handle_auto.emit("automation-task-state",serde_json::json!({"taskId":id,"status":status}));
                                }
                            }
                            // A new module process starts without runners; stale rows only grow.
                            rows.clear();
                        }
                    }
                }
                if let Ok(mut cached)=cached_auto.lock(){
                    let revision=cached["revision"].as_u64().unwrap_or(0)+1;
                    if name=="automation-state"&&data.is_object(){data["revision"]=revision.into();*cached=data.clone();let _=handle_auto.emit("automation-state",&data);}
                    else if name=="module-disconnected"&&cached["running"].as_bool().unwrap_or(false){cached["running"]=false.into();cached["phase"]="failed".into();cached["error"]="自动化模块意外退出".into();cached["revision"]=revision.into();let _=handle_auto.emit("automation-state",cached.clone());}
                }
                if name == "automation-task-state" || name == "automation-state" || name == "module-disconnected" {
                    let latest = if name == "automation-task-state" { Some(data["status"].clone()) } else if name == "automation-state" { Some(data.clone()) } else { None };
                    let mut rows:Vec<Value> = cached_tasks.lock().ok().and_then(|v| v.as_object().map(|rows| rows.values().filter(|v| v["running"] == true).cloned().collect())).unwrap_or_default();
                    if let Ok(status) = cached_auto.lock() { if status["running"] == true { rows.push(status.clone()); } }
                    automation_bar::update(&handle_auto, rows, latest);
                }
                if name == "automation-task-state" && data["status"]["running"] == false || name == "automation-state" && data["running"] == false {
                    let handle = handle_auto.clone();
                    tauri::async_runtime::spawn_blocking(move || {
                        let state = handle.state::<AppState>();
                        if let Ok(mut module) = state.automation.lock() {
                            let running = state.automation_status.lock()
                                .map(|status| status["running"].as_bool().unwrap_or(false))
                                .unwrap_or(true);
                            let tasks_running=state.automation_task_status.lock().map(|tasks|tasks.as_object().is_some_and(|rows|rows.values().any(|row|row["running"]==true))).unwrap_or(true);
                            if !running && !tasks_running && !state.automation_editor.load(Ordering::Relaxed) {
                                module.shutdown();
                            }
                        };
                    });
                }
            });
            let crosshair_status = Arc::new(Mutex::new(CrosshairStatus::default()));
            let cached = crosshair_status.clone();
            let handle = app.handle().clone();
            let crosshair = ModuleClient::new(
                "crosshair",
                bundled.join("crosshair"),
                installed.as_ref().map(|path| path.join("crosshair")),
                image_directory,
                move |name, data| {
                    if name == "crosshair-state" {
                        if let Ok(status) = serde_json::from_value::<CrosshairStatus>(data.clone())
                        {
                            if let Ok(mut cached) = cached.lock() {
                                *cached = status;
                            }
                            let _ = handle.emit("crosshair-state", data);
                        }
                    } else if name == "module-disconnected" {
                        if let Ok(mut cached) = cached.lock() {
                            let was_running = cached.running;
                            *cached = CrosshairStatus {
                                error: was_running.then(|| "准星模块意外退出".into()),
                                ..CrosshairStatus::default()
                            };
                            let _ = handle.emit("crosshair-state", cached.clone());
                        }
                    }
                },
            );
            // Loading happens off the UI thread through bootstrap. Failure never overwrites data.
            app.manage(AppState {
                auxiliary: Mutex::new(None),
                store: Mutex::new(store),
                game_library: Mutex::new(game_library),
                crosshair: Mutex::new(crosshair),
                crosshair_status,
                crosshair_editor:AtomicBool::new(false),
                automation:Mutex::new(automation),
                automation_status,
                automation_task_status,
                automation_editor:AtomicBool::new(false),
                quitting: AtomicBool::new(false),
            });
            let show = MenuItem::with_id(app, "show", "打开工具箱", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出工具箱", true, None::<&str>)?;
            let stop = MenuItem::with_id(app, "stop-crosshair", "关闭准星", true, None::<&str>)?;
            let stop_automation=MenuItem::with_id(app,"stop-automation","停止自动化",true,None::<&str>)?;
            let menu = Menu::with_items(app, &[&stop, &stop_automation, &show, &quit])?;
            let icon = app.default_window_icon().ok_or("Missing app icon")?.clone();
            TrayIconBuilder::new()
                .icon(icon)
                .tooltip("moligod")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main(app),
                    "quit" => request_exit(app.clone()),
                    "stop-crosshair" => {
                        let app = app.clone();
                        tauri::async_runtime::spawn_blocking(move || {
                            if let Ok(mut overlay) = app.state::<AppState>().crosshair.lock() {
                                overlay.shutdown();
                            }
                        });
                    }
                    "stop-automation"=>{let app=app.clone();tauri::async_runtime::spawn_blocking(move||{if let Ok(mut module)=app.state::<AppState>().automation.lock(){module.shutdown();}});}
                    _ => {}
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if tool_windows::is_editor(window.label()) {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    if window.label() == "tool-automation" { auxiliary::close_active(window.app_handle()); }
                    // Hiding keeps drafts; the page treats it as closing and releases idle modules.
                    tool_windows::notify_visibility(window, window.label(), false);
                    if let Err(error) = window.hide() { eprintln!("Cannot hide tool window: {error}"); }
                }
                return;
            }
            if window.label() != "main" { return; }
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                auxiliary::close_active(window.app_handle());
                api.prevent_close();
                if let Err(error) = window.hide() { eprintln!("Cannot hide toolbox window: {error}"); }
            }
        })
        .invoke_handler(tauri::generate_handler![
            github::official_component_catalog, github::official_component_code,
            github::check_app_update, github::install_app_update,
            tool_windows::open_tool_window,
            toolbox_window::set_toolbox_expanded, toolbox_window::toolbox_dock, toolbox_window::toolbox_drag,
            automation_bar::automation_bar_state, automation_bar::dismiss_automation_bar, automation_bar::resize_automation_bar,
            auxiliary::open_auxiliary, auxiliary::close_auxiliary, auxiliary::auxiliary_state, auxiliary::submit_auxiliary,
            capture_directory::choose_capture_directory,
            bootstrap,
            save_config,
            game_library::load_game_library,
            game_library::save_game_library,
            open_delta_guide, open_website,
            crosshair_action,
            crosshair_monitors,
            import_crosshair_image,
            crosshair_image_preview
            ,automation_action
        ])
        .run(tauri::generate_context!())
        .expect("moligod failed to start");
}
