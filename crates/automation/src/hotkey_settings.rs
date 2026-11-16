use serde::{Deserialize, Serialize};
use std::{
    io::{Read, Write},
    path::Path,
};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HotkeySettings {
    pub schema_version: u32,
    pub modifiers: u32,
    pub key: u32,
}
impl Default for HotkeySettings {
    fn default() -> Self {
        Self {
            schema_version: 1,
            modifiers: 3,
            key: 121,
        }
    }
}
impl HotkeySettings {
    pub fn display(self) -> String {
        let mut parts = Vec::new();
        if self.modifiers & 2 != 0 {
            parts.push("Ctrl".to_string());
        }
        if self.modifiers & 1 != 0 {
            parts.push("Alt".to_string());
        }
        if self.modifiers & 4 != 0 {
            parts.push("Shift".to_string());
        }
        parts.push(if (112..=135).contains(&self.key) {
            format!("F{}", self.key - 111)
        } else {
            char::from_u32(self.key).unwrap_or('?').to_string()
        });
        parts.join(" + ")
    }
    pub fn validate(self) -> Result<(), String> {
        if self.schema_version != 1 {
            return Err("不支持的快捷键设置版本，原文件已保留".into());
        }
        let function = (112..=135).contains(&self.key) && self.key != 123;
        let letter = (48..=57).contains(&self.key) || (65..=90).contains(&self.key);
        if self.modifiers > 7 || !(function || (letter && self.modifiers & 3 != 0)) {
            return Err(
                "无效的紧急停止快捷键：使用功能键（F12除外），或Ctrl/Alt加字母、数字".into(),
            );
        }
        Ok(())
    }
}
pub fn load(directory: &Path) -> Result<HotkeySettings, String> {
    let file = match std::fs::File::open(directory.join("hotkey-settings.json")) {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(HotkeySettings::default())
        }
        Err(error) => return Err(error.to_string()),
    };
    let mut bytes = Vec::new();
    file.take(4097)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() > 4096 {
        return Err("快捷键设置文件超过限制，原文件已保留".into());
    }
    let settings: HotkeySettings =
        serde_json::from_slice(&bytes).map_err(|_| "快捷键设置无效，原文件已保留")?;
    settings.validate()?;
    Ok(settings)
}
pub fn save(directory: &Path, settings: HotkeySettings) -> Result<(), String> {
    settings.validate()?;
    load(directory)?;
    std::fs::create_dir_all(directory).map_err(|e| e.to_string())?;
    let target = directory.join("hotkey-settings.json");
    if target.exists() {
        std::fs::copy(&target, directory.join("hotkey-settings.json.bak"))
            .map_err(|e| e.to_string())?;
    }
    let mut temp = tempfile::NamedTempFile::new_in(directory).map_err(|e| e.to_string())?;
    temp.write_all(&serde_json::to_vec_pretty(&settings).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    temp.as_file().sync_all().map_err(|e| e.to_string())?;
    temp.persist(target).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn defaults_round_trip_backup_and_invalid_data_protection() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(load(dir.path()).unwrap(), HotkeySettings::default());
        assert!(!dir.path().join("hotkey-settings.json").exists());
        let custom = HotkeySettings {
            key: 119,
            modifiers: 6,
            ..HotkeySettings::default()
        };
        save(dir.path(), custom).unwrap();
        assert_eq!(load(dir.path()).unwrap(), custom);
        save(dir.path(), HotkeySettings::default()).unwrap();
        assert_eq!(
            serde_json::from_slice::<HotkeySettings>(
                &std::fs::read(dir.path().join("hotkey-settings.json.bak")).unwrap()
            )
            .unwrap(),
            custom
        );
        for bytes in [
            b"corrupt".as_slice(),
            br#"{"schemaVersion":2,"modifiers":3,"key":121}"#,
            br#"{"schemaVersion":1,"modifiers":3,"key":121,"unknown":true}"#,
        ] {
            std::fs::write(dir.path().join("hotkey-settings.json"), bytes).unwrap();
            assert!(save(dir.path(), custom).is_err());
            assert_eq!(
                std::fs::read(dir.path().join("hotkey-settings.json")).unwrap(),
                bytes
            );
        }
    }
    #[test]
    fn rejects_modifiers_reserved_keys_and_unmodified_typing() {
        for (key, modifiers) in [(17, 3), (123, 3), (65, 0), (65, 4), (121, 8), (256, 3)] {
            assert!(HotkeySettings {
                key,
                modifiers,
                ..HotkeySettings::default()
            }
            .validate()
            .is_err());
        }
        for (key, modifiers) in [(119, 0), (135, 7), (65, 3), (48, 2), (120, 3)] {
            HotkeySettings {
                key,
                modifiers,
                ..HotkeySettings::default()
            }
            .validate()
            .unwrap();
        }
    }
}
