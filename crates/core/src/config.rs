use serde::{Deserialize, Serialize};

pub const CONFIG_VERSION: u32 = 3;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum HotkeyMode {
    Toggle,
    Hold,
    HoldShow,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CrosshairStyle {
    #[serde(alias = "mixed")]
    Cross,
    Dot,
    Circle,
    Image,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Crosshair {
    pub size: u16,
    pub thickness: u8,
    pub gap: u8,
    pub color: String,
    pub style: CrosshairStyle,
    pub dot_size: u8,
    pub opacity: u8,
    pub monitor: String,
    pub offset_x: i32,
    pub offset_y: i32,
    /// Windows virtual-key code. Listening only while the tool is running.
    pub hotkey: Option<u8>,
    pub hotkey_mode: HotkeyMode,
    /// Managed PNG name (SHA-256), never a caller-supplied filesystem path.
    pub image_id: Option<String>,
    pub image_scale: u16,
}

impl Default for Crosshair {
    fn default() -> Self {
        Self {
            size: 24,
            thickness: 2,
            gap: 4,
            color: "#c4f568".into(),
            style: CrosshairStyle::Cross,
            dot_size: 4,
            opacity: 100,
            monitor: String::new(),
            offset_x: 0,
            offset_y: 0,
            hotkey: Some(119),
            hotkey_mode: HotkeyMode::Toggle,
            image_id: None,
            image_scale: 100,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Config {
    pub schema_version: u32,
    pub close_to_tray: bool,
    pub crosshair: Crosshair,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            schema_version: CONFIG_VERSION,
            close_to_tray: false,
            crosshair: Crosshair::default(),
        }
    }
}

impl Config {
    pub fn validate(&self) -> Result<(), String> {
        if self.schema_version != CONFIG_VERSION {
            return Err("配置版本不受当前客户端支持".into());
        }
        self.crosshair.validate()
    }
}

impl Crosshair {
    pub fn validate(&self) -> Result<(), String> {
        let c = self;
        if !(8..=96).contains(&c.size) || !(1..=8).contains(&c.thickness) || c.gap > 20 {
            return Err("准星参数超出允许范围".into());
        }
        if c.color.len() != 7
            || !c.color.starts_with('#')
            || !c.color.as_bytes()[1..].iter().all(u8::is_ascii_hexdigit)
        {
            return Err("准星颜色必须是 #RRGGBB".into());
        }
        if !(1..=32).contains(&c.dot_size)
            || !(10..=100).contains(&c.opacity)
            || !(5..=200).contains(&c.image_scale)
            || c.offset_x.abs_diff(0) > 16384
            || c.offset_y.abs_diff(0) > 16384
            || c.monitor.len() > 64
            || c.hotkey.is_some_and(|key| {
                !([1, 2, 4, 5, 6].contains(&key) || ((8..=254).contains(&key) && key != 229))
            })
        {
            return Err("准星参数超出允许范围".into());
        }
        if c.image_id
            .as_ref()
            .is_some_and(|id| id.len() != 64 || !id.bytes().all(|b| b.is_ascii_hexdigit()))
        {
            return Err("图片标识无效".into());
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_future_versions_and_invalid_input() {
        let mut c = Config::default();
        assert!(c.validate().is_ok());
        c.schema_version += 1;
        assert!(c.validate().is_err());
        c = Config::default();
        c.crosshair.color = "#💥fff".into();
        assert!(c.validate().is_err());
        c.crosshair = Crosshair::default();
        c.crosshair.size = 0;
        assert!(c.validate().is_err());
    }
}
