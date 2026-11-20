use crate::model::OcrModel;
use serde::{Deserialize, Serialize};
use std::{io::Read, path::Path};

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum OcrDevice {
    #[default]
    Cpu,
    #[serde(alias = "gpu")]
    Amd,
    Nvidia,
}
impl OcrDevice {
    pub fn name(self) -> &'static str {
        match self {
            Self::Cpu => "cpu",
            Self::Amd => "amd",
            Self::Nvidia => "nvidia",
        }
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct OcrSettings {
    pub schema_version: u32,
    pub model: OcrModel,
    pub device: OcrDevice,
}
impl Default for OcrSettings {
    fn default() -> Self {
        Self {
            schema_version: 1,
            model: OcrModel::Small,
            device: OcrDevice::Cpu,
        }
    }
}
pub fn load(directory: &Path) -> Result<OcrSettings, String> {
    let file = match std::fs::File::open(directory.join("ocr-settings.json")) {
        Ok(file) => file,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(OcrSettings::default()),
        Err(e) => return Err(e.to_string()),
    };
    let mut bytes = Vec::new();
    file.take(4097)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() > 4096 {
        return Err("OCR 设置文件超过限制，原文件已保留".into());
    }
    let settings: OcrSettings =
        serde_json::from_slice(&bytes).map_err(|_| "OCR 设置无效，原文件已保留")?;
    validate(settings)?;
    Ok(settings)
}
fn validate(settings: OcrSettings) -> Result<(), String> {
    if settings.schema_version != 1 {
        return Err("不支持的 OCR 设置版本，原文件已保留".into());
    }
    Ok(())
}
pub fn save(directory: &Path, settings: OcrSettings) -> Result<(), String> {
    validate(settings)?;
    load(directory)?;
    crate::atomic_file::replace_with_backup(
        directory,
        "ocr-settings.json",
        &serde_json::to_vec_pretty(&settings).map_err(|e| e.to_string())?,
        4096,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn legacy_gpu_maps_to_directml_and_three_backends_round_trip() {
        let old: OcrSettings =
            serde_json::from_str(r#"{"schemaVersion":1,"model":"tiny","device":"gpu"}"#).unwrap();
        assert_eq!(old.device, OcrDevice::Amd);
        for device in [OcrDevice::Cpu, OcrDevice::Amd, OcrDevice::Nvidia] {
            let settings = OcrSettings {
                device,
                ..OcrSettings::default()
            };
            assert_eq!(
                serde_json::from_str::<OcrSettings>(&serde_json::to_string(&settings).unwrap())
                    .unwrap(),
                settings
            );
        }
    }
    #[test]
    fn global_settings_persist_and_protect_invalid_data() {
        let directory = tempfile::tempdir().unwrap();
        assert_eq!(load(directory.path()).unwrap(), OcrSettings::default());
        let settings = OcrSettings {
            model: OcrModel::Tiny,
            device: OcrDevice::Nvidia,
            ..OcrSettings::default()
        };
        save(directory.path(), settings).unwrap();
        assert_eq!(load(directory.path()).unwrap(), settings);
        save(directory.path(), OcrSettings::default()).unwrap();
        assert_eq!(
            serde_json::from_slice::<OcrSettings>(
                &std::fs::read(directory.path().join("ocr-settings.json.bak")).unwrap()
            )
            .unwrap(),
            settings
        );
        for invalid in [
            br#"{"schemaVersion":2,"model":"small","device":"cpu"}"#.as_slice(),
            br#"{"schemaVersion":1,"model":"small","device":"cuda"}"#,
            b"corrupt",
        ] {
            std::fs::write(directory.path().join("ocr-settings.json"), invalid).unwrap();
            assert!(save(directory.path(), settings).is_err());
            assert_eq!(
                std::fs::read(directory.path().join("ocr-settings.json")).unwrap(),
                invalid
            );
        }
    }
}
