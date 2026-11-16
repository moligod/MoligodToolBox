use base64::{engine::general_purpose::STANDARD, Engine};
use moligod_automation::{
    engine::Plan,
    model::*,
    native::{self, Automation},
    tasks::{self, SavedTask, TaskManager},
};
use moligod_core::task::Cancellation;
use moligod_module_protocol::{emit, serve, Output};
use serde_json::{json, Value};
use std::path::PathBuf;
fn ocr_preview(text: &str, numbers_only: bool, numeric_result: bool) -> Result<Value, String> {
    let value = moligod_automation::ocr_value::format_result(text, numbers_only, numeric_result)?;
    let display = match &value {
        Value::String(text) => text.clone(),
        Value::Null => String::new(),
        Value::Number(number) => number.as_f64().ok_or("识别的数字无效")?.to_string(),
        _ => return Err("识别结果无效".into()),
    };
    Ok(json!({"text":display,"value":value}))
}
fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}
fn run() -> Result<(), String> {
    let _apartment = native::WinRtApartment::new()?;
    let args: Vec<_> = std::env::args().collect();
    if args.len() != 3 || args[1] != "--data-dir" {
        return Err("This module must be started by moligod.".into());
    }
    let directory = PathBuf::from(&args[2]);
    let output: Output = std::sync::Arc::new(std::sync::Mutex::new(std::io::stdout()));
    let events = output.clone();
    let mut automation = Automation::new(directory.clone(), move |status| {
        emit(&events, "automation-state", status)
    });
    let task_events = output.clone();
    let mut tasks = TaskManager::new(directory.clone(), move |task_id, status| {
        emit(
            &task_events,
            "automation-task-state",
            json!({"taskId":task_id,"status":status}),
        )
    });
    let mut preview = moligod_automation::preview::PreviewFrame::default();
    let result = serve("automation", output, |method, payload| match method {
        "hotkey-settings" => Ok(json!(moligod_automation::hotkey_settings::load(
            &directory
        )?)),
        "hotkey-settings-save" => {
            if automation.status().running
                || tasks
                    .statuses()
                    .as_object()
                    .is_some_and(|rows| rows.values().any(|s| s["running"] == true))
            {
                return Err("请先停止所有任务再修改紧急停止快捷键".into());
            }
            let settings = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            native::save_hotkey_settings(&directory, settings)?;
            Ok(json!(settings))
        }
        "ocr-settings" => Ok(json!(moligod_automation::ocr_settings::load(&directory)?)),
        "ocr-settings-save" => {
            let settings = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            moligod_automation::ocr_settings::save(&directory, settings)?;
            Ok(json!(settings))
        }
        "status" => Ok(json!(automation.status())),
        "stop" => Ok(json!(automation.stop()?)),
        "shutdown" => {
            tasks.stop_all()?;
            Ok(json!(automation.stop()?))
        }
        "task-save" => {
            let task: SavedTask = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            tasks::save(&directory, &task)?;
            Ok(json!({"id":task.id}))
        }
        "task-list" => tasks::list(&directory),
        "component-list" => Ok(json!(moligod_automation::components::list(&directory)?)),
        "component-import" => Ok(json!(moligod_automation::components::import(
            &directory,
            payload.as_str().ok_or("缺少组件库文件内容")?
        )?)),
        "component-add" => Ok(json!(moligod_automation::components::add(
            &directory,
            serde_json::from_value(payload).map_err(|e| e.to_string())?
        )?)),
        "component-remove" => Ok(json!(moligod_automation::components::remove(
            &directory,
            payload.as_str().ok_or("缺少组件标识")?
        )?)),
        "component-rename" => Ok(json!(moligod_automation::components::rename(
            &directory,
            serde_json::from_value(payload).map_err(|e| e.to_string())?
        )?)),
        "component-move" => Ok(json!(moligod_automation::components::move_item(
            &directory,
            serde_json::from_value(payload).map_err(|e| e.to_string())?
        )?)),
        "task-reorder" => {
            let ids = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            moligod_automation::task_order::save(&directory, ids)?;
            tasks::list(&directory)
        }
        "task-load" => Ok(json!(tasks::load(
            &directory,
            payload.as_str().ok_or("缺少任务标识")?
        )?)),
        "task-delete" => {
            tasks.delete(payload.as_str().ok_or("缺少任务标识")?)?;
            Ok(json!(true))
        }
        "task-statuses" => Ok(tasks.statuses()),
        "task-stop" => Ok(json!(tasks.stop(payload.as_str().ok_or("缺少任务标识")?)?)),
        "task-stop-all" => {
            tasks.stop_all()?;
            Ok(tasks.statuses())
        }
        "task-start" => {
            let id = payload
                .get("id")
                .and_then(|v| v.as_str())
                .ok_or("缺少任务标识")?;
            let bindings: Bindings =
                serde_json::from_value(payload.get("bindings").cloned().ok_or("缺少窗口绑定")?)
                    .map_err(|e| e.to_string())?;
            Ok(json!(tasks.start(id, bindings)?))
        }
        "window-metrics" => {
            let window: BoundWindow = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            Ok(json!(native::window_scale(&window)?))
        }
        "windows" => Ok(json!(native::windows()?)),
        "pick-point" => {
            if automation.status().running {
                return Err("请先停止脚本再取坐标".into());
            }
            let window: BoundWindow =
                serde_json::from_value(payload.get("window").cloned().ok_or("缺少窗口")?)
                    .map_err(|e| e.to_string())?;
            native::pick_point(&window)
        }
        "validate" => {
            Plan::compile(serde_json::from_value(payload).map_err(|e| e.to_string())?)?;
            Ok(json!({"valid":true}))
        }
        "test-action" => {
            if automation.status().running
                || tasks
                    .statuses()
                    .as_object()
                    .is_some_and(|rows| rows.values().any(|s| s["running"] == true))
            {
                return Err("请先停止正在运行的任务再测试动作".into());
            }
            let action: Action =
                serde_json::from_value(payload["action"].clone()).map_err(|e| e.to_string())?;
            let slot = match &action {
                Action::Click { target, .. }
                | Action::Drag { target, .. }
                | Action::Scroll { target, .. } => target.clone(),
                _ => return Err("仅支持测试鼠标动作".into()),
            };
            let window: BoundWindow =
                serde_json::from_value(payload["window"].clone()).map_err(|e| e.to_string())?;
            let script: Script = serde_json::from_value(json!({"缩放":payload.get("scale"),"schemaVersion":1,"name":"测试动作","repeats":1,"maxRunSeconds":65,"startDelayMs":0,"steps":[{"delayMs":0,"action":action}]})).map_err(|e| e.to_string())?;
            Ok(json!(
                automation.start(script, Bindings::from([(slot, window)]))?
            ))
        }
        "start" => {
            let script: Script =
                serde_json::from_value(payload.get("script").cloned().ok_or("缺少脚本")?)
                    .map_err(|e| e.to_string())?;
            let bindings: Bindings =
                serde_json::from_value(payload.get("bindings").cloned().ok_or("缺少窗口绑定")?)
                    .map_err(|e| e.to_string())?;
            Ok(json!(automation.start(script, bindings)?))
        }
        "save" => {
            let script: Script = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            Ok(json!({"id":native::save_script(&directory,&script)?}))
        }
        "list" => native::list_scripts(&directory),
        "load" => Ok(json!(native::load_script(
            &directory,
            payload.as_str().ok_or("缺少脚本标识")?
        )?)),
        "import-template" => {
            let bytes = STANDARD
                .decode(payload.as_str().ok_or("图片数据无效")?)
                .map_err(|e| e.to_string())?;
            Ok(json!({"id":native::import_template(&bytes,&directory)?}))
        }
        "template-image" => {
            let image = native::load_template(&directory, payload.as_str().ok_or("缺少模板标识")?)?;
            Ok(json!({"png":STANDARD.encode(native::png_preview(&image)?)}))
        }
        "preview" | "ocr-test" => {
            if method == "ocr-test" && payload.get("snapshot").is_some() {
                let snapshot = payload["snapshot"].as_str().ok_or("预览截图标识无效")?;
                let region: Region =
                    serde_json::from_value(payload["region"].clone()).map_err(|e| e.to_string())?;
                let image = preview.crop(snapshot, region)?;
                let mut driver = native::NativeDriver::new(directory.clone())?;
                let text = driver.recognize(&image, &Cancellation::default())?;
                return ocr_preview(
                    &text,
                    payload["numbersOnly"] == true,
                    payload["numericResult"] == true,
                );
            }
            let window: BoundWindow =
                serde_json::from_value(payload.get("window").cloned().ok_or("缺少窗口")?)
                    .map_err(|e| e.to_string())?;
            let token = Cancellation::default();
            let mut driver = native::NativeDriver::new(directory.clone())?;
            let numbers_only = payload
                .get("numbersOnly")
                .and_then(serde_json::Value::as_bool)
                .unwrap_or(false);
            let region: Region = if method == "preview" && payload["fullWindow"] == true {
                native::full_client_region(&window)?
            } else {
                serde_json::from_value(payload.get("region").cloned().ok_or("缺少区域")?)
                    .map_err(|e| e.to_string())?
            };
            let scale = native::window_scale(&window)?;
            let image = native::capture(&window, region, &token)?;
            if native::window_scale(&window)? != scale {
                return Err("截图期间窗口缩放发生变化，请刷新截图".into());
            }
            if method == "ocr-test" {
                let text = driver.recognize(&image, &token)?;
                return ocr_preview(&text, numbers_only, payload["numericResult"] == true);
            }
            let width = image.width();
            let height = image.height();
            let png = STANDARD.encode(native::png_preview(&image)?);
            let snapshot = preview.replace(image)?;
            Ok(json!({"width":width,"height":height,"scale":scale,"snapshot":snapshot,"png":png}))
        }
        _ => Err("未知自动化模块操作".into()),
    });
    let _ = automation.stop();
    let _ = tasks.stop_all();
    result
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn preview_matches_numeric_and_legacy_outputs() {
        assert_eq!(
            ocr_preview("价格785", true, true).unwrap(),
            json!({"text":"785","value":785})
        );
        assert_eq!(
            ocr_preview("未识别", true, true).unwrap(),
            json!({"text":"","value":null})
        );
        assert_eq!(
            ocr_preview("001", true, false).unwrap(),
            json!({"text":"001","value":"001"})
        );
        assert!(ocr_preview("1.2.3", true, true).is_err());
    }
}
