use serde::{Deserialize, Serialize};
use std::{collections::BTreeSet, io::Read, path::Path};

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Order {
    schema_version: u32,
    ids: Vec<String>,
}
pub fn load(directory: &Path) -> Result<Vec<String>, String> {
    let file = match std::fs::File::open(directory.join("task-order.json")) {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(error.to_string()),
    };
    let mut bytes = Vec::new();
    file.take(256 * 1024 + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() > 256 * 1024 {
        return Err("任务排序文件超过限制，原文件已保留".into());
    }
    let order: Order =
        serde_json::from_slice(&bytes).map_err(|_| "任务排序文件无效，原文件已保留")?;
    if order.schema_version != 1
        || order.ids.len() > 4096
        || order.ids.iter().any(|id| !crate::tasks::id_valid(id))
        || order.ids.iter().collect::<BTreeSet<_>>().len() != order.ids.len()
    {
        return Err("任务排序版本或内容无效，原文件已保留".into());
    }
    Ok(order.ids)
}
pub fn save(directory: &Path, mut ids: Vec<String>) -> Result<(), String> {
    let previous = load(directory)?;
    let rows = crate::tasks::list(directory)?;
    let current: BTreeSet<_> = rows
        .as_array()
        .ok_or("任务列表无效")?
        .iter()
        .filter_map(|row| row["id"].as_str())
        .collect();
    let requested: BTreeSet<_> = ids.iter().map(String::as_str).collect();
    if ids.len() > 64 || requested.len() != ids.len() || requested != current {
        return Err("任务列表已变化，请刷新后重新排序".into());
    }
    // Preserve references to archived/unavailable tasks without rewriting any task file.
    let absent: Vec<_> = previous
        .into_iter()
        .filter(|id| !requested.contains(id.as_str()))
        .collect();
    ids.extend(absent);
    if ids.len() > 4096 {
        return Err("保存的任务排序数量超过限制，原文件已保留".into());
    }
    crate::atomic_file::replace_with_backup(
        directory,
        "task-order.json",
        &serde_json::to_vec_pretty(&Order {
            schema_version: 1,
            ids,
        })
        .map_err(|e| e.to_string())?,
        256 * 1024,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tasks::{self, SavedTask};
    use serde_json::json;
    #[test]
    fn persisted_order_preserves_scripts_and_rejects_stale_or_corrupt_data() {
        let dir = tempfile::tempdir().unwrap();
        let ids = [
            "12345678-1234-1234-1234-123456789ab1",
            "12345678-1234-1234-1234-123456789ab2",
            "12345678-1234-1234-1234-123456789ab3",
        ];
        let mut originals = Vec::new();
        for (i, id) in ids.iter().enumerate() {
            let task: SavedTask = serde_json::from_value(json!({"schemaVersion":2,"id":id,"name":format!("task{i}"),"intervalMs":1000,"script":{"schemaVersion":1,"name":"t","steps":[{"action":{"type":"wait","ms":1}}]}})).unwrap();
            tasks::save(dir.path(), &task).unwrap();
            originals
                .push(std::fs::read(dir.path().join("tasks").join(format!("{id}.json"))).unwrap());
        }
        let reordered: Vec<String> = [ids[2], ids[0], ids[1]].map(String::from).to_vec();
        save(dir.path(), reordered.clone()).unwrap();
        assert_eq!(load(dir.path()).unwrap(), reordered);
        assert_eq!(tasks::list(dir.path()).unwrap()[0]["id"], ids[2]);
        assert!(save(dir.path(), vec![ids[0].into()]).is_err());
        assert!(save(dir.path(), vec![ids[0].into(); 3]).is_err());
        for (id, bytes) in ids.iter().zip(originals) {
            assert_eq!(
                std::fs::read(dir.path().join("tasks").join(format!("{id}.json"))).unwrap(),
                bytes
            );
        }
        tasks::archive(dir.path(), ids[2]).unwrap();
        save(dir.path(), vec![ids[1].into(), ids[0].into()]).unwrap();
        assert!(load(dir.path()).unwrap().contains(&ids[2].to_owned()));
        for invalid in [
            b"bad".as_slice(),
            br#"{"schemaVersion":2,"ids":[]}"#,
            br#"{"schemaVersion":1,"ids":[],"future":true}"#,
        ] {
            std::fs::write(dir.path().join("task-order.json"), invalid).unwrap();
            assert!(save(dir.path(), vec![ids[0].into(), ids[1].into()]).is_err());
            assert_eq!(
                std::fs::read(dir.path().join("task-order.json")).unwrap(),
                invalid
            );
        }
    }
}
