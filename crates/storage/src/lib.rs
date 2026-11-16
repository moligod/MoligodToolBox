//! Single-writer configuration storage. Caller serializes load/save operations.
//! Never replace an unreadable or newer configuration with defaults.
pub mod game_library;

use moligod_core::config::Config;
use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
};

const MAX_BYTES: u64 = 64 * 1024;

pub struct ConfigStore {
    path: PathBuf,
}

impl ConfigStore {
    pub fn new(directory: &Path) -> Self {
        Self {
            path: directory.join("settings.json"),
        }
    }
    pub fn load(&self) -> Result<Config, String> {
        match fs::File::open(&self.path) {
            Ok(file) => {
                let mut bytes = Vec::new();
                file.take(MAX_BYTES + 1)
                    .read_to_end(&mut bytes)
                    .map_err(|e| e.to_string())?;
                if bytes.len() as u64 > MAX_BYTES {
                    return Err("配置文件超过 64 KiB，已保留原文件".into());
                }
                decode_config(&bytes)
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Config::default()),
            Err(e) => Err(e.to_string()),
        }
    }
    pub fn save(&self, config: &Config) -> Result<(), String> {
        config.validate()?;
        self.load()?;
        let directory = self.path.parent().ok_or("配置目录无效")?;
        fs::create_dir_all(directory).map_err(|e| e.to_string())?;
        if self.path.exists() {
            let old = fs::read(&self.path).map_err(|e| e.to_string())?;
            atomic_write(&self.path.with_extension("json.bak"), &old)?;
        }
        let bytes = serde_json::to_vec_pretty(config).map_err(|e| e.to_string())?;
        atomic_write(&self.path, &bytes)
    }
}

fn decode_config(bytes: &[u8]) -> Result<Config, String> {
    let mut value: serde_json::Value =
        serde_json::from_slice(bytes).map_err(|e| format!("无法读取配置，已保留原文件：{e}"))?;
    if value.get("schemaVersion").and_then(|v| v.as_u64()) == Some(1) {
        let crosshair = value
            .get_mut("crosshair")
            .and_then(|v| v.as_object_mut())
            .ok_or("旧版准星配置无效")?;
        // Preserve v1 fields; add only the known new fields. No writes on load.
        for (key, default) in serde_json::to_value(moligod_core::config::Crosshair::default())
            .map_err(|e| e.to_string())?
            .as_object()
            .ok_or("默认配置无效")?
        {
            if !["size", "thickness", "gap", "color"].contains(&key.as_str()) {
                if crosshair.contains_key(key) {
                    return Err("v1 配置包含新版字段，已保留原文件".into());
                }
                crosshair.insert(key.clone(), default.clone());
            }
        }
        value["schemaVersion"] = 3.into();
    }
    if value.get("schemaVersion").and_then(|v| v.as_u64()) == Some(2) {
        let c = value
            .get_mut("crosshair")
            .and_then(|v| v.as_object_mut())
            .ok_or("准星配置无效")?;
        if c.contains_key("hotkeyMode") {
            return Err("旧配置包含新格式字段，已保留原文件".into());
        }
        if let Some(key) = c.get("hotkey").and_then(|v| v.as_u64()) {
            if !(6..=11).contains(&key) {
                return Err("旧配置快捷键无效".into());
            }
            c.insert("hotkey".into(), (111 + key).into());
        }
        c.insert("hotkeyMode".into(), "toggle".into());
        value["schemaVersion"] = 3.into();
    }
    let config: Config = serde_json::from_value(value).map_err(|e| format!("配置格式无效：{e}"))?;
    config.validate()?;
    Ok(config)
}

fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let mut temp = tempfile::NamedTempFile::new_in(path.parent().ok_or("目录无效")?)
        .map_err(|e| e.to_string())?;
    temp.write_all(bytes).map_err(|e| e.to_string())?;
    temp.as_file().sync_all().map_err(|e| e.to_string())?;
    temp.persist(path).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn persists_and_keeps_previous_valid_revision() {
        let dir = tempfile::tempdir().unwrap();
        let store = ConfigStore::new(dir.path());
        let initial = store.load().unwrap();
        assert!(!store.path.exists());
        store.save(&initial).unwrap();
        let mut changed = initial.clone();
        changed.close_to_tray = true;
        store.save(&changed).unwrap();
        assert_eq!(store.load().unwrap(), changed);
        let backup: Config =
            serde_json::from_slice(&fs::read(store.path.with_extension("json.bak")).unwrap())
                .unwrap();
        assert_eq!(backup, initial);
    }
    #[test]
    fn new_hold_show_mode_round_trips_without_replacing_existing_settings() {
        let dir = tempfile::tempdir().unwrap();
        let store = ConfigStore::new(dir.path());
        let initial = Config::default();
        store.save(&initial).unwrap();
        let mut next = initial.clone();
        next.crosshair.hotkey_mode = moligod_core::config::HotkeyMode::HoldShow;
        next.crosshair.hotkey = Some(5);
        store.save(&next).unwrap();
        assert_eq!(store.load().unwrap(), next);
        assert_eq!(
            decode_config(&fs::read(store.path.with_extension("json.bak")).unwrap()).unwrap(),
            initial
        );
    }
    #[test]
    fn refuses_to_overwrite_corrupt_future_or_oversized_data() {
        let dir = tempfile::tempdir().unwrap();
        let store = ConfigStore::new(dir.path());
        let future = Config {
            schema_version: 4,
            ..Config::default()
        };
        for data in [
            b"broken".to_vec(),
            serde_json::to_vec(&future).unwrap(),
            vec![b' '; MAX_BYTES as usize + 1],
        ] {
            fs::write(&store.path, &data).unwrap();
            assert!(store.load().is_err());
            assert!(store.save(&Config::default()).is_err());
            assert_eq!(fs::read(&store.path).unwrap(), data);
        }
    }

    #[test]
    fn upgrades_our_v1_config_without_touching_the_original() {
        let dir = tempfile::tempdir().unwrap();
        let store = ConfigStore::new(dir.path());
        let old = br##"{"schemaVersion":1,"closeToTray":true,"crosshair":{"size":32,"thickness":3,"gap":8,"color":"#112233"}}"##;
        fs::write(&store.path, old).unwrap();
        let current = store.load().unwrap();
        assert_eq!(current.schema_version, 3);
        assert_eq!(current.crosshair.size, 32);
        assert!(current.close_to_tray);
        assert_eq!(fs::read(&store.path).unwrap(), old);
        store.save(&current).unwrap();
        assert_eq!(
            fs::read(store.path.with_extension("json.bak")).unwrap(),
            old
        );
    }

    #[test]
    fn upgrades_keyboard_number_without_changing_the_bound_key() {
        let mut value = serde_json::to_value(Config::default()).unwrap();
        value["schemaVersion"] = 2.into();
        value["crosshair"]["hotkey"] = 8.into();
        value["crosshair"]
            .as_object_mut()
            .unwrap()
            .remove("hotkeyMode");
        let result = decode_config(&serde_json::to_vec(&value).unwrap()).unwrap();
        assert_eq!(result.crosshair.hotkey, Some(119));
        assert_eq!(
            result.crosshair.hotkey_mode,
            moligod_core::config::HotkeyMode::Toggle
        );
    }
}
