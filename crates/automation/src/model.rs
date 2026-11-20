use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Script {
    #[serde(default, rename = "缩放", skip_serializing_if = "Option::is_none")]
    pub scale: Option<u32>,
    pub schema_version: u32,
    pub name: String,
    #[serde(default = "one")]
    pub repeats: u32,
    #[serde(default = "hour")]
    pub max_run_seconds: u32,
    #[serde(default)]
    pub start_delay_ms: u32,
    #[serde(default)]
    pub interval_ms: u32,
    pub steps: Vec<Step>,
    #[serde(skip)]
    pub execution_map: Vec<usize>,
}
fn one() -> u32 {
    1
}
fn hour() -> u32 {
    3600
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Step {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub inputs: Option<crate::inputs::Inputs>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub annotation: Option<String>,
    #[serde(default)]
    pub delay_ms: u32,
    #[serde(default)]
    pub random_delay_ms: u32,
    pub action: Action,
}
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(try_from = "String", into = "String")]
pub enum Slot {
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
    J,
    K,
    L,
    M,
    N,
    O,
    P,
    Q,
    R,
    S,
    T,
    U,
    V,
    W,
    X,
    Y,
    Z,
    Window(String),
}
impl TryFrom<String> for Slot {
    type Error = String;
    fn try_from(value: String) -> Result<Self, Self::Error> {
        if let Some(title) = value.strip_prefix("window:") {
            if title.trim().is_empty() || title.len() > 2048 {
                return Err("窗口标题无效".into());
            }
            return Ok(Self::Window(title.to_owned()));
        }
        match value.as_str() {
            "A" => Ok(Self::A),
            "B" => Ok(Self::B),
            "C" => Ok(Self::C),
            "D" => Ok(Self::D),
            "E" => Ok(Self::E),
            "F" => Ok(Self::F),
            "G" => Ok(Self::G),
            "H" => Ok(Self::H),
            "I" => Ok(Self::I),
            "J" => Ok(Self::J),
            "K" => Ok(Self::K),
            "L" => Ok(Self::L),
            "M" => Ok(Self::M),
            "N" => Ok(Self::N),
            "O" => Ok(Self::O),
            "P" => Ok(Self::P),
            "Q" => Ok(Self::Q),
            "R" => Ok(Self::R),
            "S" => Ok(Self::S),
            "T" => Ok(Self::T),
            "U" => Ok(Self::U),
            "V" => Ok(Self::V),
            "W" => Ok(Self::W),
            "X" => Ok(Self::X),
            "Y" => Ok(Self::Y),
            "Z" => Ok(Self::Z),
            _ => Err("窗口目标无效".into()),
        }
    }
}
impl From<Slot> for String {
    fn from(slot: Slot) -> Self {
        match slot {
            Slot::Window(title) => format!("window:{title}"),
            legacy => format!("{legacy:?}"),
        }
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BoundWindow {
    pub hwnd: u64,
    pub pid: u32,
    pub title: String,
    pub width: i32,
    pub height: i32,
}
pub type Bindings = BTreeMap<Slot, BoundWindow>;

#[cfg(test)]
mod slot_tests {
    use super::*;
    #[test]
    fn window_slots_round_trip_and_reject_unknown_names() {
        for name in 'A'..='Z' {
            let encoded = format!("\"{name}\"");
            let slot: Slot = serde_json::from_str(&encoded).unwrap();
            assert_eq!(serde_json::to_string(&slot).unwrap(), encoded);
        }
        assert!(serde_json::from_str::<Slot>("\"AA\"").is_err());
        let named: Slot = serde_json::from_str("\"window:QQ\"").unwrap();
        assert_eq!(named, Slot::Window("QQ".into()));
        assert_eq!(serde_json::to_string(&named).unwrap(), "\"window:QQ\"");
        assert!(serde_json::from_str::<Slot>("\"window: \"").is_err());
        let bindings: Bindings = serde_json::from_value(serde_json::json!({
            "C":{"hwnd":123,"pid":456,"title":"test","width":640,"height":480}
        }))
        .unwrap();
        assert_eq!(bindings[&Slot::C].pid, 456);
    }
}
#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Region {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}
#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TemplatePoint {
    pub x: u32,
    pub y: u32,
}
#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MouseButton {
    Left,
    Right,
    Middle,
}
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MouseMode {
    #[default]
    Foreground,
    Background,
}
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum OcrModel {
    #[default]
    Small,
    Tiny,
}
impl OcrModel {
    pub fn name(self) -> &'static str {
        match self {
            Self::Small => "small",
            Self::Tiny => "tiny",
        }
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum Action {
    Wait {
        ms: u32,
    },
    ScheduleStart {
        time: String,
    },
    SetWindow {
        target: Slot,
        title: String,
    },
    Focus {
        target: Slot,
    },
    Click {
        target: Slot,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        position: Option<String>,
        #[serde(default)]
        mode: MouseMode,
        x: i32,
        y: i32,
        button: MouseButton,
        #[serde(default)]
        hold_ms: u32,
        #[serde(default)]
        jitter: u16,
    },
    Drag {
        target: Slot,
        #[serde(default)]
        mode: MouseMode,
        from_x: i32,
        from_y: i32,
        to_x: i32,
        to_y: i32,
        duration_ms: u32,
        button: MouseButton,
    },
    Scroll {
        target: Slot,
        #[serde(default)]
        mode: MouseMode,
        x: i32,
        y: i32,
        delta: i32,
    },
    Key {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        target: Option<Slot>,
        keys: Vec<u16>,
        #[serde(default)]
        hold_ms: u32,
    },
    KeyDown {
        keys: Vec<u16>,
    },
    KeyUp {
        keys: Vec<u16>,
    },
    RunTask {
        task_id: String,
    },
    WaitUntil {
        expression: String,
        timeout_ms: u32,
        interval_ms: u32,
    },
    HoldUntil {
        expression: String,
        timeout_ms: u32,
        interval_ms: u32,
    },
    // Field-less actions are empty struct variants, not unit variants: serde ignores
    // unknown keys on internally tagged unit variants despite deny_unknown_fields,
    // which would let a save silently drop data. The JSON stays {"type":"..."}.
    EndWaitUntil {},
    Text {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        target: Option<Slot>,
        text: String,
    },
    Ocr {
        target: Slot,
        #[serde(default)]
        ocr_model: OcrModel,
        region: Region,
        variable: String,
        #[serde(default)]
        numbers_only: bool,
        #[serde(default, skip_serializing_if = "std::ops::Not::not")]
        numeric_result: bool,
        #[serde(default)]
        reuse: bool,
    },
    Match {
        target: Slot,
        region: Region,
        template: String,
        threshold: f64,
        variable: String,
        #[serde(default, skip_serializing_if = "std::ops::Not::not")]
        save_position: bool,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        template_point: Option<TemplatePoint>,
    },
    Capture {
        target: Slot,
        region: Region,
        name: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        directory: Option<String>,
    },
    Set {
        variable: String,
        value: Value,
    },
    Group {
        name: String,
        steps: Vec<Step>,
    },
    Calculate {
        variable: String,
        expression: String,
    },
    If {
        expression: String,
    },
    ElseIf {
        expression: String,
    },
    Else {},
    EndIf {},
    Loop {
        count: u32,
    },
    EndLoop {},
    Break {},
    Continue {},
    Label {
        name: String,
    },
    Goto {
        label: String,
    },
    Assert {
        expression: String,
        message: String,
        #[serde(default, skip_serializing_if = "std::ops::Not::not")]
        stop_when_true: bool,
    },
    Regex {
        variable: String,
        pattern: String,
        result: String,
    },
    Comment {
        text: String,
    },
    Notify {
        text: String,
    },
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub running: bool,
    pub phase: String,
    pub step: usize,
    pub executed: u64,
    #[serde(default)]
    pub round: u32,
    #[serde(default)]
    pub total_steps: usize,
    #[serde(default)]
    pub task_name: String,
    #[serde(default)]
    pub ocr_model: String,
    #[serde(default)]
    pub ocr_device: String,
    #[serde(default)]
    pub stop_hotkey: String,
    #[serde(default)]
    pub notice: Option<String>,
    pub error: Option<String>,
    pub variables: BTreeMap<String, Value>,
    pub logs: Vec<String>,
}
impl Status {
    pub fn idle() -> Self {
        Self {
            phase: "idle".into(),
            ..Self::default()
        }
    }
}
pub fn valid_variable(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 40
        && name
            .bytes()
            .enumerate()
            .all(|(i, c)| c.is_ascii_alphabetic() || c == b'_' || (i > 0 && c.is_ascii_digit()))
}

#[cfg(test)]
mod annotation_tests {
    use super::*;

    #[test]
    fn annotations_roundtrip_without_changing_legacy_steps() {
        let legacy =
            serde_json::json!({"delayMs":0,"randomDelayMs":0,"action":{"type":"wait","ms":1000}});
        let old: Step = serde_json::from_value(legacy.clone()).unwrap();
        assert!(old.annotation.is_none());
        assert_eq!(serde_json::to_value(&old).unwrap(), legacy);
        let mut annotated = legacy;
        annotated["annotation"] = serde_json::json!("等界面加载 <ready>");
        let step: Step = serde_json::from_value(annotated.clone()).unwrap();
        assert_eq!(step.annotation.as_deref(), Some("等界面加载 <ready>"));
        assert_eq!(serde_json::to_value(step).unwrap(), annotated);
    }
}

#[cfg(test)]
mod mouse_mode_tests {
    use super::*;
    #[test]
    fn legacy_mouse_defaults_and_background_roundtrip() {
        for raw in [
            serde_json::json!({"type":"click","target":"A","x":2,"y":3,"button":"left"}),
            serde_json::json!({"type":"drag","target":"A","fromX":2,"fromY":3,"toX":4,"toY":5,"durationMs":50,"button":"left"}),
            serde_json::json!({"type":"scroll","target":"A","x":2,"y":3,"delta":-120}),
        ] {
            let action: Action = serde_json::from_value(raw.clone()).unwrap();
            assert_eq!(serde_json::to_value(action).unwrap()["mode"], "foreground");
            let mut background = raw;
            background["mode"] = serde_json::json!("background");
            let action: Action = serde_json::from_value(background.clone()).unwrap();
            assert_eq!(serde_json::to_value(action).unwrap()["mode"], "background");
            background["mode"] = serde_json::json!("invalid");
            assert!(serde_json::from_value::<Action>(background).is_err());
        }
    }
}

#[cfg(test)]
mod script_scale_tests {
    use super::*;
    #[test]
    fn single_scale_header_roundtrips_and_legacy_stays_unknown() {
        let mut raw = serde_json::json!({"schemaVersion":1,"name":"old","steps":[{"action":{"type":"wait","ms":1}}]});
        let old: Script = serde_json::from_value(raw.clone()).unwrap();
        assert_eq!(old.scale, None);
        assert!(serde_json::to_value(old).unwrap().get("缩放").is_none());
        raw["缩放"] = serde_json::json!(150);
        let script: Script = serde_json::from_value(raw).unwrap();
        assert_eq!(script.scale, Some(150));
        assert!(serde_json::to_string(&script)
            .unwrap()
            .starts_with("{\"缩放\":150,"));
        assert_eq!(serde_json::to_value(script).unwrap()["缩放"], 150);
    }
}

#[cfg(test)]
mod optional_input_tests {
    use super::*;
    #[test]
    fn input_targets_are_optional_and_legacy_targets_survive() {
        for mut value in [
            serde_json::json!({"type":"key","keys":[17,65]}),
            serde_json::json!({"type":"text","text":"hello"}),
        ] {
            let action: Action = serde_json::from_value(value.clone()).unwrap();
            assert!(serde_json::to_value(action)
                .unwrap()
                .get("target")
                .is_none());
            for target in ["A", "window:QQ"] {
                value["target"] = serde_json::json!(target);
                let action: Action = serde_json::from_value(value.clone()).unwrap();
                assert_eq!(serde_json::to_value(action).unwrap()["target"], target);
            }
        }
        assert!(serde_json::from_value::<Action>(serde_json::json!({"type":"focus"})).is_err());
    }
}

#[cfg(test)]
mod ocr_model_tests {
    use super::*;
    #[test]
    fn old_ocr_defaults_to_small_and_both_models_roundtrip() {
        for mut value in [
            serde_json::json!({"type":"ocr","target":"A","region":{"x":0,"y":0,"width":50,"height":20},"variable":"result"}),
        ] {
            let action: Action = serde_json::from_value(value.clone()).unwrap();
            assert_eq!(serde_json::to_value(action).unwrap()["ocrModel"], "small");
            for model in ["small", "tiny"] {
                value["ocrModel"] = serde_json::json!(model);
                let action: Action = serde_json::from_value(value.clone()).unwrap();
                assert_eq!(serde_json::to_value(action).unwrap()["ocrModel"], model);
            }
            value["ocrModel"] = serde_json::json!("unknown");
            assert!(serde_json::from_value::<Action>(value).is_err());
        }
    }
}
