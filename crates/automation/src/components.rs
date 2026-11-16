//! Versioned local library of reusable Blockly action trees.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{collections::BTreeSet, io::Write, path::Path};

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Component {
    pub id: String,
    pub name: String,
    pub block: Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scale: Option<u32>,
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Library {
    schema_version: u32,
    components: Vec<Component>,
}
fn validate(library: &Library) -> Result<(), String> {
    let mut ids = BTreeSet::new();
    if library.schema_version != 1 || library.components.len() > 100 {
        return Err("组件库版本不支持或数量过多，原文件已保留".into());
    }
    for item in &library.components {
        if !crate::tasks::id_valid(&item.id)
            || !ids.insert(&item.id)
            || item.name.trim().is_empty()
            || item.name.chars().count() > 60
            || item.name.chars().any(char::is_control)
            || item.block.get("type").and_then(Value::as_str) != Some("moligod_action")
            || item
                .scale
                .is_some_and(|scale| !(50..=1000).contains(&scale))
        {
            return Err("组件库内容无效，原文件已保留".into());
        }
    }
    Ok(())
}
fn load(directory: &Path) -> Result<Library, String> {
    let file = directory.join("components.json");
    match std::fs::metadata(&file) {
        Ok(_) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(Library {
                schema_version: 1,
                components: vec![],
            });
        }
        Err(error) => return Err(error.to_string()),
    }
    let bytes = crate::native::read_limited(&file, 1024 * 1024)?;
    let library: Library =
        serde_json::from_slice(&bytes).map_err(|_| "组件库格式无效，原文件已保留")?;
    validate(&library)?;
    Ok(library)
}
pub fn list(directory: &Path) -> Result<Vec<Component>, String> {
    Ok(load(directory)?.components)
}
fn save(directory: &Path, library: &Library) -> Result<(), String> {
    validate(library)?;
    let bytes = serde_json::to_vec_pretty(library).map_err(|e| e.to_string())?;
    if bytes.len() > 1024 * 1024 {
        return Err("组件库超过1MiB".into());
    }
    std::fs::create_dir_all(directory).map_err(|e| e.to_string())?;
    let mut temp = tempfile::NamedTempFile::new_in(directory).map_err(|e| e.to_string())?;
    temp.write_all(&bytes).map_err(|e| e.to_string())?;
    temp.as_file().sync_all().map_err(|e| e.to_string())?;
    temp.persist(directory.join("components.json"))
        .map_err(|e| e.to_string())?;
    Ok(())
}
pub fn add(directory: &Path, item: Component) -> Result<Vec<Component>, String> {
    let mut library = load(directory)?;
    library.components.push(item);
    save(directory, &library)?;
    Ok(library.components)
}
pub fn import(directory: &Path, text: &str) -> Result<Vec<Component>, String> {
    if text.len() > 1024 * 1024 {
        return Err("组件库文件超过1MiB".into());
    }
    let incoming: Library = serde_json::from_str(text.trim_start_matches('\u{feff}'))
        .map_err(|_| "组件库格式无效，原文件已保留")?;
    validate(&incoming)?;
    let mut library = load(directory)?;
    let mut ids: BTreeSet<String> = library
        .components
        .iter()
        .map(|item| item.id.clone())
        .collect();
    let mut sequence = 0;
    for mut item in incoming.components {
        while !ids.insert(item.id.clone()) {
            item.id = format!("00000000-0000-4000-8000-{sequence:012x}");
            sequence += 1;
        }
        library.components.push(item);
    }
    save(directory, &library)?;
    Ok(library.components)
}
pub fn remove(directory: &Path, id: &str) -> Result<Vec<Component>, String> {
    let mut library = load(directory)?;
    let old = library.components.len();
    library.components.retain(|item| item.id != id);
    if old == library.components.len() {
        return Err("组件不存在".into());
    }
    save(directory, &library)?;
    Ok(library.components)
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Rename {
    pub id: String,
    pub name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Move {
    pub id: String,
    pub target_id: String,
    pub after: bool,
}

pub fn rename(directory: &Path, change: Rename) -> Result<Vec<Component>, String> {
    let mut library = load(directory)?;
    let name = change.name.trim();
    if name.is_empty() || name.chars().count() > 60 || name.chars().any(char::is_control) {
        return Err("组件名称请输入1–60个字符".into());
    }
    let item = library
        .components
        .iter_mut()
        .find(|item| item.id == change.id)
        .ok_or("组件不存在")?;
    item.name = name.to_owned();
    if let Some(action) = item.block.pointer_mut("/extraState/step/action") {
        if action.get("type").and_then(Value::as_str) == Some("group") {
            action["name"] = Value::String(name.to_owned());
        }
    }
    save(directory, &library)?;
    Ok(library.components)
}

pub fn move_item(directory: &Path, change: Move) -> Result<Vec<Component>, String> {
    let mut library = load(directory)?;
    let from = library
        .components
        .iter()
        .position(|item| item.id == change.id)
        .ok_or("组件不存在")?;
    if !library
        .components
        .iter()
        .any(|item| item.id == change.target_id)
    {
        return Err("目标组件不存在".into());
    }
    if change.id == change.target_id {
        return Ok(library.components);
    }
    let item = library.components.remove(from);
    let target = library
        .components
        .iter()
        .position(|item| item.id == change.target_id)
        .ok_or("目标组件不存在")?;
    library
        .components
        .insert(target + usize::from(change.after), item);
    save(directory, &library)?;
    Ok(library.components)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    const IMPORT_FIXTURE: &str =
        include_str!("../../../tests/fixtures/automation-components-v1.json");

    #[test]
    fn imports_append_and_roundtrip_old_components_with_unique_ids() {
        let dir = tempfile::tempdir().unwrap();
        let first = import(dir.path(), IMPORT_FIXTURE).unwrap();
        assert_eq!(first.len(), 2);
        assert_eq!(first[0].scale, None);
        assert_eq!(first[1].scale, Some(125));
        let merged = import(dir.path(), IMPORT_FIXTURE).unwrap();
        assert_eq!(merged.len(), 4);
        assert_eq!(
            merged
                .iter()
                .map(|item| &item.id)
                .collect::<BTreeSet<_>>()
                .len(),
            4
        );
        assert_eq!(merged[0].id, first[0].id);
        assert_eq!(merged[2].block, first[0].block);
        assert_eq!(merged[3].scale, first[1].scale);
        let exported = serde_json::to_string(&Library {
            schema_version: 1,
            components: merged,
        })
        .unwrap();
        let other = tempfile::tempdir().unwrap();
        let restored = import(other.path(), &exported).unwrap();
        assert_eq!(restored.len(), 4);
        assert_eq!(restored[2].name, first[0].name);
        assert_eq!(restored[3].block, first[1].block);
    }

    #[test]
    fn invalid_or_oversized_imports_never_partially_write() {
        let dir = tempfile::tempdir().unwrap();
        import(dir.path(), IMPORT_FIXTURE).unwrap();
        let path = dir.path().join("components.json");
        let original = std::fs::read(&path).unwrap();
        let mut invalid: Value = serde_json::from_str(IMPORT_FIXTURE).unwrap();
        invalid["components"][1]["name"] = json!("");
        let mut duplicates: Value = serde_json::from_str(IMPORT_FIXTURE).unwrap();
        duplicates["components"][1]["id"] = duplicates["components"][0]["id"].clone();
        for data in [
            "not json".into(),
            "{\"schemaVersion\":2,\"components\":[]}".into(),
            "{\"schemaVersion\":1,\"components\":[],\"future\":true}".into(),
            invalid.to_string(),
            duplicates.to_string(),
            " ".repeat(1024 * 1024 + 1),
        ] {
            assert!(import(dir.path(), &data).is_err());
            assert_eq!(std::fs::read(&path).unwrap(), original);
        }
        let mut full: Library = serde_json::from_str(IMPORT_FIXTURE).unwrap();
        full.components = (0..99)
            .map(|i| Component {
                id: format!("00000000-0000-4000-8000-{i:012x}"),
                ..full.components[0].clone()
            })
            .collect();
        save(dir.path(), &full).unwrap();
        let before = std::fs::read(&path).unwrap();
        assert!(import(dir.path(), IMPORT_FIXTURE).is_err());
        assert_eq!(std::fs::read(&path).unwrap(), before);
        for data in ["broken", "{\"schemaVersion\":2,\"components\":[]}"] {
            std::fs::write(&path, data).unwrap();
            assert!(import(dir.path(), IMPORT_FIXTURE).is_err());
            assert_eq!(std::fs::read_to_string(&path).unwrap(), data);
        }
    }
    #[test]
    fn roundtrips_and_never_overwrites_corrupt_or_future_library() {
        let dir = tempfile::tempdir().unwrap();
        let component = Component {
            id: "b10c0000-0000-4000-8000-000000000001".into(),
            name: "测试".into(),
            block: json!({"type":"moligod_action","extraState":{"step":{"action":{"type":"wait"}}}}),
            scale: Some(100),
        };
        assert!(list(dir.path()).unwrap().is_empty());
        assert_eq!(add(dir.path(), component.clone()).unwrap().len(), 1);
        assert!(add(dir.path(), component.clone()).is_err());
        assert_eq!(list(dir.path()).unwrap()[0].block, component.block);
        assert!(remove(dir.path(), &component.id).unwrap().is_empty());
        for data in ["not json", "{\"schemaVersion\":2,\"components\":[]}"] {
            std::fs::write(dir.path().join("components.json"), data).unwrap();
            assert!(add(dir.path(), component.clone()).is_err());
            assert_eq!(
                std::fs::read_to_string(dir.path().join("components.json")).unwrap(),
                data
            );
        }
    }

    #[test]
    fn rename_and_move_persist_without_changing_component_contents() {
        let dir = tempfile::tempdir().unwrap();
        let make = |id: &str, name: &str| Component {
            id: id.into(),
            name: name.into(),
            scale: Some(125),
            block: json!({"type":"moligod_action","extraState":{"step":{"action":{"type":"group","name":name,"steps":[{"type":"wait","ms":800}]}}}}),
        };
        let first = make("b10c0000-0000-4000-8000-000000000001", "第一项");
        let second = make("b10c0000-0000-4000-8000-000000000002", "第二项");
        add(dir.path(), first.clone()).unwrap();
        add(dir.path(), second.clone()).unwrap();
        rename(
            dir.path(),
            Rename {
                id: first.id.clone(),
                name: " 新名称 ".into(),
            },
        )
        .unwrap();
        let reordered = move_item(
            dir.path(),
            Move {
                id: first.id.clone(),
                target_id: second.id.clone(),
                after: true,
            },
        )
        .unwrap();
        assert_eq!(reordered[0].id, second.id);
        assert_eq!(reordered[1].name, "新名称");
        assert_eq!(
            reordered[1].block.pointer("/extraState/step/action/name"),
            Some(&json!("新名称"))
        );
        assert_eq!(
            reordered[1].block.pointer("/extraState/step/action/steps"),
            first.block.pointer("/extraState/step/action/steps")
        );
        assert_eq!(list(dir.path()).unwrap()[1].id, first.id);
        let before = std::fs::read(dir.path().join("components.json")).unwrap();
        assert!(rename(
            dir.path(),
            Rename {
                id: first.id.clone(),
                name: " ".into()
            }
        )
        .is_err());
        assert!(move_item(
            dir.path(),
            Move {
                id: first.id.clone(),
                target_id: "unknown".into(),
                after: false
            }
        )
        .is_err());
        assert_eq!(
            std::fs::read(dir.path().join("components.json")).unwrap(),
            before
        );
        for data in ["not json", "{\"schemaVersion\":2,\"components\":[]}"] {
            std::fs::write(dir.path().join("components.json"), data).unwrap();
            assert!(rename(
                dir.path(),
                Rename {
                    id: first.id.clone(),
                    name: "名称".into()
                }
            )
            .is_err());
            assert!(move_item(
                dir.path(),
                Move {
                    id: first.id.clone(),
                    target_id: second.id.clone(),
                    after: false
                }
            )
            .is_err());
            assert_eq!(
                std::fs::read_to_string(dir.path().join("components.json")).unwrap(),
                data
            );
        }
    }
}
