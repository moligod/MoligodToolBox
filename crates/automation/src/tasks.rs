use crate::{
    engine::Plan,
    model::{Bindings, Script, Slot, Status},
    native::{read_limited, Automation},
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use std::{
    collections::BTreeMap,
    io::Write,
    path::{Path, PathBuf},
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SavedTask {
    pub schema_version: u32,
    pub id: String,
    pub name: String,
    pub interval_ms: u32,
    #[serde(default)]
    pub r#loop: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub repeat_count: Option<u32>,
    pub script: Script,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LegacyTask {
    #[serde(rename = "schemaVersion")]
    _schema_version: u32,
    id: String,
    name: String,
    #[serde(rename = "source")]
    _source: Slot,
    interval_ms: u32,
    script: Script,
}
fn decode(bytes: &[u8], id: &str) -> Result<SavedTask, String> {
    let value: Value = serde_json::from_slice(bytes).map_err(|e| e.to_string())?;
    let task = match value["schemaVersion"].as_u64() {
        Some(1) => {
            let legacy: LegacyTask = serde_json::from_value(value).map_err(|e| e.to_string())?;
            // The former task-level source was only a start prerequisite. Action targets stay intact.
            let LegacyTask {
                _schema_version: _,
                id,
                name,
                _source: _,
                interval_ms,
                script,
            } = legacy;
            SavedTask {
                schema_version: 2,
                r#loop: false,
                repeat_count: None,
                id,
                name,
                interval_ms,
                script,
            }
        }
        Some(2) => serde_json::from_value(value).map_err(|e| e.to_string())?,
        _ => return Err("不支持的任务版本，原文件已保留".into()),
    };
    validate(&task)?;
    if task.id != id {
        return Err("任务文件标识不匹配".into());
    }
    Ok(task)
}
pub(crate) fn id_valid(id: &str) -> bool {
    id.len() == 36
        && id.bytes().enumerate().all(|(i, b)| {
            if [8, 13, 18, 23].contains(&i) {
                b == b'-'
            } else {
                b.is_ascii_hexdigit()
            }
        })
}
fn validate(task: &SavedTask) -> Result<(), String> {
    if task.schema_version != 2
        || !id_valid(&task.id)
        || task.name.trim().is_empty()
        || task.name.len() > 100
        || !(100..=3_600_000).contains(&task.interval_ms)
        || task.repeat_count.is_some_and(|count| count > 100_000)
    {
        return Err("任务版本、标识、名称或间隔无效".into());
    }
    Plan::compile(task.script.clone())?;
    Ok(())
}
fn path(directory: &Path, id: &str) -> Result<PathBuf, String> {
    if !id_valid(id) {
        return Err("任务标识无效".into());
    }
    Ok(directory.join("tasks").join(format!("{id}.json")))
}
pub fn save(directory: &Path, task: &SavedTask) -> Result<(), String> {
    validate(task)?;
    let target = path(directory, &task.id)?;
    let bytes = serde_json::to_vec_pretty(task).map_err(|e| e.to_string())?;
    if bytes.len() > 1024 * 1024 {
        return Err("任务文件超过1MiB".into());
    }
    let folder = target.parent().ok_or("任务目录无效")?;
    std::fs::create_dir_all(folder).map_err(|e| e.to_string())?;
    if !target.exists()
        && std::fs::read_dir(folder)
            .map_err(|e| e.to_string())?
            .filter_map(Result::ok)
            .filter(|entry| entry.file_name().to_string_lossy().ends_with(".json"))
            .take(64)
            .count()
            >= 64
    {
        return Err("最多保存64个任务，请先归档旧任务".into());
    }
    if target.exists() {
        let previous = read_limited(&target, 1024 * 1024)?;
        decode(&previous, &task.id)?;
        // Keep the original version-1 bytes before the first explicit save in the new format.
        if serde_json::from_slice::<Value>(&previous).map_err(|e| e.to_string())?["schemaVersion"]
            == 1
        {
            let backup = target.with_extension("json.v1.bak");
            if !backup.exists() {
                let mut temp =
                    tempfile::NamedTempFile::new_in(folder).map_err(|e| e.to_string())?;
                temp.write_all(&previous).map_err(|e| e.to_string())?;
                temp.as_file().sync_all().map_err(|e| e.to_string())?;
                temp.persist_noclobber(backup).map_err(|e| e.to_string())?;
            }
        }
    }
    let mut temp = tempfile::NamedTempFile::new_in(folder).map_err(|e| e.to_string())?;
    temp.write_all(&bytes).map_err(|e| e.to_string())?;
    temp.as_file().sync_all().map_err(|e| e.to_string())?;
    temp.persist(target).map_err(|e| e.to_string())?;
    Ok(())
}
pub fn load(directory: &Path, id: &str) -> Result<SavedTask, String> {
    let bytes = read_limited(&path(directory, id)?, 1024 * 1024)?;
    decode(&bytes, id)
        .map_err(|error| format!("任务包含不支持的动作或无效格式，原文件已保留：{error}"))
}

/// Resolve a snapshot of saved tasks before any native input. Calls share variables,
/// cancellation and input ownership, but do not inherit the child's scheduling options.
pub(crate) fn expand_calls(directory: &Path, script: Script) -> Result<Script, String> {
    use crate::model::{Action, Step};
    struct Expansion<'a> {
        directory: &'a Path,
        scale: Option<u32>,
        stack: Vec<String>,
        serial: usize,
        version: u32,
        steps: Vec<Step>,
        map: Vec<usize>,
    }
    impl Expansion<'_> {
        fn append(&mut self, step: Step, index: usize) -> Result<(), String> {
            if self.steps.len() >= 1000 {
                return Err("调用任务展开后超过1000步".into());
            }
            self.steps.push(step);
            self.map.push(index);
            Ok(())
        }
        fn expand(&mut self, script: Script, parent: Option<usize>) -> Result<(), String> {
            let script = Plan::compile(script)?.script;
            self.version = self.version.max(script.schema_version);
            self.serial += 1;
            let prefix = format!("__call{}_", self.serial);
            let names: BTreeMap<_, _> = script
                .steps
                .iter()
                .enumerate()
                .filter_map(|(i, s)| {
                    if let Action::Label { name } = &s.action {
                        Some((name.clone(), format!("{prefix}{i}")))
                    } else {
                        None
                    }
                })
                .collect();
            for (i, mut step) in script.steps.into_iter().enumerate() {
                let index = parent.unwrap_or(i);
                if let Action::RunTask { task_id } = &step.action {
                    if self.stack.contains(task_id) || self.stack.len() >= 8 {
                        return Err("任务存在循环调用或调用超过8层".into());
                    }
                    let child = load(self.directory, task_id)
                        .map_err(|e| format!("无法运行所选任务：{e}"))?;
                    self.stack.push(task_id.clone());
                    step.action = Action::Wait { ms: 0 };
                    self.append(step, index)?;
                    self.expand(child.script, Some(index))?;
                    self.stack.pop();
                } else {
                    match &mut step.action {
                        Action::Label { name } => *name = names[name].clone(),
                        Action::Goto { label } => *label = names[label].clone(),
                        _ => {}
                    }
                    if let Some(source) = script.scale {
                        let current = self
                            .scale
                            .ok_or("请先打开并保存主任务，确定屏幕缩放后再调用任务")?;
                        if source != current {
                            step.action = crate::coordinates::adapt(&step.action, source, current)?;
                            if let Some(inputs) = &mut step.inputs {
                                for value in inputs.values.values_mut() {
                                    value.adapt(source, current)?;
                                }
                            }
                        }
                    }
                    self.append(step, index)?;
                }
            }
            Ok(())
        }
    }
    let mut expanded = Expansion {
        directory,
        scale: script.scale,
        stack: Vec::new(),
        serial: 0,
        version: 1,
        steps: Vec::new(),
        map: Vec::new(),
    };
    expanded.expand(script.clone(), None)?;
    Ok(Script {
        schema_version: expanded.version.max(
            if expanded
                .steps
                .iter()
                .any(|s| s.inputs.is_some() || matches!(s.action, Action::HoldUntil { .. }))
            {
                2
            } else {
                1
            },
        ),
        steps: expanded.steps,
        execution_map: expanded.map,
        ..script
    })
}
pub fn list(directory: &Path) -> Result<Value, String> {
    let folder = directory.join("tasks");
    if !folder.exists() {
        return Ok(json!([]));
    }
    let mut rows = Vec::new();
    for entry in std::fs::read_dir(folder)
        .map_err(|e| e.to_string())?
        .take(200)
    {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if let Some(id) = name.strip_suffix(".json") {
            if !id_valid(id) {
                continue;
            }
            match load(directory, id) {
                Ok(task) => rows.push(json!({"id":id,"name":task.name,"intervalMs":task.interval_ms,"loop":task.r#loop,"repeatCount":task.repeat_count})),
                Err(error) => {
                    // Show unavailable tasks without treating their script as editable or rewriting it.
                    let metadata: Value = read_limited(&entry.path(), 1024 * 1024)
                        .ok()
                        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
                        .unwrap_or(Value::Null);
                    let name = metadata["name"].as_str().filter(|name| name.len() <= 100).unwrap_or(id);
                    rows.push(json!({"id":id,"name":name,"intervalMs":1000,"error":error}));
                }
            }
        }
    }
    let order = crate::task_order::load(directory)?;
    rows.sort_by(|a, b| {
        let rank = |row: &Value| {
            order
                .iter()
                .position(|id| row["id"].as_str() == Some(id))
                .unwrap_or(usize::MAX)
        };
        rank(a)
            .cmp(&rank(b))
            .then_with(|| a["name"].as_str().cmp(&b["name"].as_str()))
            .then_with(|| a["id"].as_str().cmp(&b["id"].as_str()))
    });
    Ok(json!(rows))
}
pub fn archive(directory: &Path, id: &str) -> Result<(), String> {
    let _ = load(directory, id)?;
    let source = path(directory, id)?;
    let trash = directory.join("tasks").join("trash");
    std::fs::create_dir_all(&trash).map_err(|e| e.to_string())?;
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    std::fs::rename(source, trash.join(format!("{id}-{stamp}.json"))).map_err(|e| e.to_string())
}
pub struct TaskManager {
    directory: PathBuf,
    runners: BTreeMap<String, Automation>,
    observer: Arc<dyn Fn(String, Status) + Send + Sync>,
}
impl TaskManager {
    pub fn new(
        directory: PathBuf,
        observer: impl Fn(String, Status) + Send + Sync + 'static,
    ) -> Self {
        Self {
            directory,
            runners: BTreeMap::new(),
            observer: Arc::new(observer),
        }
    }
    pub fn start(&mut self, id: &str, bindings: Bindings) -> Result<Status, String> {
        let task = load(&self.directory, id)?;
        let active = self
            .runners
            .values()
            .filter(|runner| runner.status().running)
            .count();
        if active >= 4
            && !self
                .runners
                .get(id)
                .is_some_and(|runner| runner.status().running)
        {
            return Err("最多同时运行4个任务".into());
        }
        let observer = self.observer.clone();
        let task_id = id.to_owned();
        let runner = self.runners.entry(task_id.clone()).or_insert_with(|| {
            Automation::new(self.directory.clone(), move |status| {
                (observer)(task_id.clone(), status)
            })
        });
        let mut script = task.script;
        script.repeats = task.repeat_count.unwrap_or(if task.r#loop { 0 } else { 1 });
        script.interval_ms = if script.repeats != 1 {
            task.interval_ms
        } else {
            0
        };
        runner.start(script, bindings)
    }
    pub fn stop(&mut self, id: &str) -> Result<Status, String> {
        if !id_valid(id) {
            return Err("任务标识无效".into());
        }
        if let Some(runner) = self.runners.get_mut(id) {
            runner.stop()
        } else {
            Ok(Status::idle())
        }
    }
    pub fn stop_all(&mut self) -> Result<(), String> {
        for runner in self.runners.values() {
            runner.cancel();
        }
        for runner in self.runners.values_mut() {
            runner.stop()?;
        }
        Ok(())
    }
    pub fn statuses(&self) -> Value {
        json!(self
            .runners
            .iter()
            .map(|(id, runner)| (id.clone(), runner.status()))
            .collect::<BTreeMap<_, _>>())
    }
    pub fn delete(&mut self, id: &str) -> Result<(), String> {
        self.stop(id)?;
        archive(&self.directory, id)?;
        self.runners.remove(id);
        Ok(())
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn calls_snapshot_saved_steps_share_variables_and_reject_cycles() {
        use crate::{engine::Driver, model::Action};
        use moligod_core::task::Cancellation;
        struct NoIo;
        impl Driver for NoIo {
            fn perform(
                &mut self,
                _: &Action,
                _: &Bindings,
                _: &Cancellation,
            ) -> Result<Option<(String, Value)>, String> {
                panic!("unexpected input")
            }
        }
        let dir = tempfile::tempdir().unwrap();
        let id = "12345678-1234-1234-1234-123456789abc";
        let mut task:SavedTask=serde_json::from_value(json!({"schemaVersion":2,"id":id,"name":"child","intervalMs":1000,"loop":true,"script":{"schemaVersion":1,"name":"child","repeats":99,"startDelayMs":60000,"steps":[{"action":{"type":"label","name":"same"}},{"action":{"type":"calculate","expression":"count+1","variable":"count"}}]}})).unwrap();
        save(dir.path(), &task).unwrap();
        let source:Script=serde_json::from_value(json!({"schemaVersion":1,"name":"parent","steps":[{"action":{"type":"label","name":"same"}},{"action":{"type":"set","variable":"count","value":0}},{"action":{"type":"runTask","taskId":id}},{"action":{"type":"runTask","taskId":id}},{"action":{"type":"notify","text":"count ${count}"}}]})).unwrap();
        let original = serde_json::to_vec(&source).unwrap();
        let expanded = expand_calls(dir.path(), source.clone()).unwrap();
        assert_eq!(serde_json::to_vec(&source).unwrap(), original);
        assert_eq!(expanded.execution_map, [0, 1, 2, 2, 2, 3, 3, 3, 4]);
        let state = Plan::compile(expanded)
            .unwrap()
            .run(
                &mut NoIo,
                &Bindings::new(),
                &Cancellation::default(),
                |_| {},
            )
            .unwrap();
        assert_eq!(state.variables["count"], 2.0);
        assert_eq!(state.total_steps, 5);
        assert_eq!(state.step, 4);
        assert_eq!(state.notice.as_deref(), Some("count 2.0"));
        task.script.steps[1].action = Action::RunTask { task_id: id.into() };
        save(dir.path(), &task).unwrap();
        assert!(expand_calls(dir.path(), source.clone())
            .unwrap_err()
            .contains("循环调用"));
        archive(dir.path(), id).unwrap();
        assert!(expand_calls(dir.path(), source)
            .unwrap_err()
            .contains("无法运行"));
    }
    #[test]
    fn called_coordinates_use_parent_baseline_and_variables_keep_their_own_scale() {
        let dir = tempfile::tempdir().unwrap();
        let id = "12345678-1234-1234-1234-123456789abc";
        let task:SavedTask=serde_json::from_value(json!({"schemaVersion":2,"id":id,"name":"child","intervalMs":1000,"script":{"schemaVersion":1,"name":"child","缩放":150,"steps":[{"action":{"type":"click","target":"A","button":"left","x":150,"y":300}},{"action":{"type":"click","target":"A","button":"left","position":"result","x":-1,"y":-1}}]}})).unwrap();
        save(dir.path(), &task).unwrap();
        let source:Script=serde_json::from_value(json!({"schemaVersion":1,"name":"parent","缩放":100,"steps":[{"action":{"type":"runTask","taskId":id}}]})).unwrap();
        let expanded = serde_json::to_value(expand_calls(dir.path(), source).unwrap()).unwrap();
        assert_eq!(expanded["steps"][1]["action"]["x"], 100);
        assert_eq!(expanded["steps"][1]["action"]["y"], 200);
        assert_eq!(expanded["steps"][2]["action"]["x"], -1);
        assert!(expanded.get("executionMap").is_none());
    }
    #[test]
    fn task_loop_controls_repetition_and_interval() {
        let dir = tempfile::tempdir().unwrap();
        let mut task: SavedTask = serde_json::from_value(json!({"schemaVersion":2,"id":"12345678-1234-1234-1234-123456789abc","name":"repeat","intervalMs":60000,"script":{"schemaVersion":1,"name":"t","steps":[{"action":{"type":"wait","ms":1}}]}})).unwrap();
        assert!(!task.r#loop); // Missing flags default to a single run.
        task.r#loop = false;
        save(dir.path(), &task).unwrap();
        assert!(!load(dir.path(), &task.id).unwrap().r#loop);
        let mut manager = TaskManager::new(dir.path().to_owned(), |_, _| {});
        manager.start(&task.id, Bindings::new()).unwrap();
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(2);
        loop {
            let status = manager.runners[&task.id].status();
            if !status.running {
                assert_eq!(status.phase, "completed");
                assert_eq!(status.executed, 1);
                break;
            }
            assert!(std::time::Instant::now() < deadline);
            std::thread::sleep(std::time::Duration::from_millis(5));
        }
        task.r#loop = true;
        save(dir.path(), &task).unwrap();
        manager.start(&task.id, Bindings::new()).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(50));
        assert!(manager.runners[&task.id].status().running);
        assert_eq!(manager.runners[&task.id].status().executed, 1);
        manager.stop(&task.id).unwrap();
        task.repeat_count = Some(3);
        task.interval_ms = 100;
        save(dir.path(), &task).unwrap();
        assert_eq!(load(dir.path(), &task.id).unwrap().repeat_count, Some(3));
        manager.start(&task.id, Bindings::new()).unwrap();
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(3);
        loop {
            let status = manager.runners[&task.id].status();
            if !status.running {
                assert_eq!(status.phase, "completed");
                assert_eq!(status.executed, 3);
                break;
            }
            assert!(std::time::Instant::now() < deadline);
            std::thread::sleep(std::time::Duration::from_millis(5));
        }
    }
    #[test]
    fn keeps_corrupt_task_when_saving_and_archives_valid_task() {
        let dir = tempfile::tempdir().unwrap();
        let mut task:SavedTask=serde_json::from_value(json!({"schemaVersion":2,"id":"12345678-1234-1234-1234-123456789abc","name":"test","intervalMs":5000,"script":{"schemaVersion":1,"name":"t","steps":[{"action":{"type":"wait","ms":1}}]}})).unwrap();
        save(dir.path(), &task).unwrap();
        assert_eq!(load(dir.path(), &task.id).unwrap().name, "test");
        let file = path(dir.path(), &task.id).unwrap();
        std::fs::write(&file, "bad").unwrap();
        task.name = "new".into();
        assert!(save(dir.path(), &task).is_err());
        assert_eq!(std::fs::read_to_string(&file).unwrap(), "bad");
        std::fs::write(&file, serde_json::to_vec(&task).unwrap()).unwrap();
        archive(dir.path(), &task.id).unwrap();
        assert!(!file.exists());
        assert_eq!(
            std::fs::read_dir(dir.path().join("tasks/trash"))
                .unwrap()
                .count(),
            1
        );
    }
    #[test]
    fn legacy_task_keeps_action_targets_and_original_bytes_until_explicit_save() {
        let dir = tempfile::tempdir().unwrap();
        let id = "12345678-1234-1234-1234-123456789abc";
        let bytes = include_bytes!("../tests/fixtures/task-v1.json");
        let file = path(dir.path(), id).unwrap();
        std::fs::create_dir_all(file.parent().unwrap()).unwrap();
        std::fs::write(&file, bytes).unwrap();
        let task = load(dir.path(), id).unwrap();
        assert_eq!(task.schema_version, 2);
        assert_eq!(task.name, "legacy");
        assert_eq!(
            serde_json::to_value(&task).unwrap()["script"]["steps"][0]["action"]["target"],
            "B"
        );
        assert_eq!(std::fs::read(&file).unwrap(), bytes);
        assert!(list(dir.path()).unwrap()[0].get("source").is_none());
        save(dir.path(), &task).unwrap();
        assert_eq!(
            std::fs::read(file.with_extension("json.v1.bak")).unwrap(),
            bytes
        );
        assert_eq!(load(dir.path(), id).unwrap().schema_version, 2);
        assert!(
            serde_json::from_slice::<Value>(&std::fs::read(&file).unwrap())
                .unwrap()
                .get("source")
                .is_none()
        );
    }
    #[test]
    fn unsupported_versions_and_unknown_fields_cannot_be_overwritten() {
        let dir = tempfile::tempdir().unwrap();
        let id = "12345678-1234-1234-1234-123456789abc";
        let original: Value =
            serde_json::from_slice(include_bytes!("../tests/fixtures/task-v1.json")).unwrap();
        let file = path(dir.path(), id).unwrap();
        std::fs::create_dir_all(file.parent().unwrap()).unwrap();
        let task = decode(&serde_json::to_vec(&original).unwrap(), id).unwrap();
        for field in ["schemaVersion", "unknown"] {
            let mut future = original.clone();
            future[field] = json!(99);
            let bytes = serde_json::to_vec(&future).unwrap();
            std::fs::write(&file, &bytes).unwrap();
            assert!(load(dir.path(), id).is_err());
            assert!(save(dir.path(), &task).is_err());
            assert_eq!(std::fs::read(&file).unwrap(), bytes);
        }
    }
    #[test]
    fn unknown_fields_on_field_less_actions_cannot_be_dropped_by_save() {
        use crate::model::Action;
        let dir = tempfile::tempdir().unwrap();
        let id = "12345678-1234-1234-1234-123456789abc";
        let bytes = include_bytes!("../tests/fixtures/task-v2-unit-action-extra.json");
        let file = path(dir.path(), id).unwrap();
        std::fs::create_dir_all(file.parent().unwrap()).unwrap();
        std::fs::write(&file, bytes).unwrap();
        assert!(load(dir.path(), id).is_err());
        let mut fixture: Value = serde_json::from_slice(bytes).unwrap();
        fixture["script"]["steps"][2]["action"]
            .as_object_mut()
            .unwrap()
            .remove("futureField");
        let mut task: SavedTask = serde_json::from_value(fixture).unwrap();
        task.name = "renamed".into();
        assert!(save(dir.path(), &task).is_err());
        assert_eq!(std::fs::read(&file).unwrap(), bytes);
        for kind in [
            "else",
            "endIf",
            "endLoop",
            "break",
            "continue",
            "endWaitUntil",
        ] {
            let plain = json!({ "type": kind });
            let action: Action = serde_json::from_value(plain.clone()).unwrap();
            assert_eq!(serde_json::to_value(&action).unwrap(), plain);
            assert!(
                serde_json::from_value::<Action>(json!({ "type": kind, "extra": 1 })).is_err(),
                "{kind} accepted an unknown field"
            );
        }
    }
    #[test]
    fn removed_actions_remain_visible_but_cannot_load_run_or_overwrite() {
        let dir = tempfile::tempdir().unwrap();
        let id = "12345678-1234-1234-1234-123456789abc";
        let mut task = decode(include_bytes!("../tests/fixtures/task-v1.json"), id).unwrap();
        task.script.steps = vec![crate::model::Step {
            inputs: None,
            delay_ms: 0,
            random_delay_ms: 0,
            annotation: None,
            action: crate::model::Action::Wait { ms: 0 },
        }];
        let legacy: Value = serde_json::from_str(include_str!(
            "../../../tests/fixtures/automation-blockly-v1.json"
        ))
        .unwrap();
        let file = path(dir.path(), id).unwrap();
        std::fs::create_dir_all(file.parent().unwrap()).unwrap();
        for step in legacy["steps"].as_array().unwrap().iter().filter(|step| {
            matches!(
                step["action"]["type"].as_str(),
                Some("ocrGroup" | "setFromOcr")
            )
        }) {
            let mut removed = serde_json::to_value(&task).unwrap();
            removed["script"]["steps"] =
                json!([{"action":{"type":"group","name":"旧组","steps":[step]}}]);
            let bytes = serde_json::to_vec(&removed).unwrap();
            std::fs::write(&file, &bytes).unwrap();
            let rows = list(dir.path()).unwrap();
            assert_eq!(rows[0]["id"], id);
            assert!(rows[0]["error"].as_str().unwrap().contains("不支持"));
            assert!(load(dir.path(), id).is_err());
            assert!(save(dir.path(), &task).is_err());
            let mut manager = TaskManager::new(dir.path().to_owned(), |_, _| {});
            assert!(manager.start(id, Bindings::new()).is_err());
            assert_eq!(std::fs::read(&file).unwrap(), bytes);
        }
    }
    #[test]
    fn window_actions_still_require_their_own_binding() {
        let dir = tempfile::tempdir().unwrap();
        let id = "12345678-1234-1234-1234-123456789abc";
        let task = decode(include_bytes!("../tests/fixtures/task-v1.json"), id).unwrap();
        save(dir.path(), &task).unwrap();
        let mut manager = TaskManager::new(dir.path().to_owned(), |_, _| {});
        let error = manager.start(id, Bindings::new()).unwrap_err();
        assert!(error.contains("脚本使用的窗口尚未绑定"), "{error}");
    }

    #[test]
    fn nested_queries_adapt_in_v2_children_and_future_inputs_cannot_be_overwritten() {
        let dir = tempfile::tempdir().unwrap();
        let id = "12345678-1234-1234-1234-123456789abc";
        let mut child:SavedTask=serde_json::from_value(json!({"schemaVersion":2,"id":id,"name":"child","intervalMs":1000,"script":{"schemaVersion":2,"name":"child","缩放":100,"steps":[{"action":{"type":"holdUntil","expression":"false","timeoutMs":1000,"intervalMs":100},"inputs":{"schemaVersion":1,"values":{"expression":{"kind":"query","action":{"type":"match","target":"A","region":{"x":10,"y":20,"width":100,"height":200},"template":"a".repeat(64),"threshold":0.9,"variable":"query_result","savePosition":false}}}}}]}})).unwrap();
        save(dir.path(), &child).unwrap();
        let parent:Script=serde_json::from_value(json!({"schemaVersion":1,"name":"parent","缩放":150,"steps":[{"action":{"type":"runTask","taskId":id}}]})).unwrap();
        let expanded = expand_calls(dir.path(), parent).unwrap();
        assert_eq!(expanded.schema_version, 2);
        assert_eq!(expanded.execution_map, vec![0, 0]);
        let raw = serde_json::to_value(expanded).unwrap();
        assert_eq!(
            raw["steps"][1]["inputs"]["values"]["expression"]["action"]["region"],
            json!({"x":15,"y":30,"width":150,"height":300})
        );
        child.script.steps[0]
            .inputs
            .as_mut()
            .unwrap()
            .schema_version = 4;
        let bytes = serde_json::to_vec(&child).unwrap();
        let file = path(dir.path(), id).unwrap();
        std::fs::write(&file, &bytes).unwrap();
        child.script.steps[0]
            .inputs
            .as_mut()
            .unwrap()
            .schema_version = 1;
        assert!(load(dir.path(), id).is_err());
        assert!(save(dir.path(), &child).is_err());
        assert_eq!(std::fs::read(file).unwrap(), bytes);
    }
    #[test]
    fn numeric_ocr_child_keeps_script_version_when_expanded() {
        let dir = tempfile::tempdir().unwrap();
        let id = "12345678-1234-1234-1234-123456789abc";
        let child: SavedTask = serde_json::from_value(json!({"schemaVersion":2,"id":id,"name":"child","intervalMs":1000,"script":{"schemaVersion":3,"name":"child","steps":[{"action":{"type":"ocr","target":"A","region":{"x":0,"y":0,"width":10,"height":10},"variable":"result","numbersOnly":true,"numericResult":true}}]}})).unwrap();
        save(dir.path(), &child).unwrap();
        let parent: Script = serde_json::from_value(json!({"schemaVersion":2,"name":"parent","steps":[{"action":{"type":"wait","ms":0},"inputs":{"schemaVersion":1,"values":{"seconds":{"kind":"literal","value":0}}}},{"action":{"type":"runTask","taskId":id}}]})).unwrap();
        let expanded = expand_calls(dir.path(), parent).unwrap();
        assert_eq!(expanded.schema_version, 3);
        assert!(Plan::compile(expanded).is_ok());
    }
}
