use crate::model::*;

pub fn adapt(action: &Action, source: u32, current: u32) -> Result<Action, String> {
    if !(50..=1000).contains(&source) || !(50..=1000).contains(&current) {
        return Err("脚本缩放信息无效".into());
    }
    let mut result = action.clone();
    let scale = |v: i32| -> Result<i32, String> {
        if v < 0 {
            return Err("坐标未设置".into());
        }
        i32::try_from(
            (i64::from(v) * i64::from(current) + i64::from(source) / 2) / i64::from(source),
        )
        .map_err(|_| "缩放后的坐标超出范围".into())
    };
    let region = |r: &mut Region| -> Result<(), String> {
        r.x = scale(r.x)?;
        r.y = scale(r.y)?;
        r.width = scale(i32::try_from(r.width).map_err(|_| "区域宽度无效")?)?.max(1) as u32;
        r.height = scale(i32::try_from(r.height).map_err(|_| "区域高度无效")?)?.max(1) as u32;
        Ok(())
    };
    match &mut result {
        Action::Click {
            position: Some(_), ..
        } => {}
        Action::Click { x, y, .. } | Action::Scroll { x, y, .. } => {
            *x = scale(*x)?;
            *y = scale(*y)?;
        }
        Action::Drag {
            from_x,
            from_y,
            to_x,
            to_y,
            ..
        } => {
            *from_x = scale(*from_x)?;
            *from_y = scale(*from_y)?;
            *to_x = scale(*to_x)?;
            *to_y = scale(*to_y)?;
        }
        Action::Ocr { region: r, .. }
        | Action::Capture { region: r, .. }
        | Action::Match { region: r, .. } => region(r)?,
        _ => {}
    }
    Ok(result)
}
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn source_baseline_does_not_accumulate_scaling() {
        let original: Action=serde_json::from_value(json!({"type":"drag","target":"A","button":"left","durationMs":500,"fromX":100,"fromY":200,"toX":300,"toY":400})).unwrap();
        for target in [125, 150, 200, 100] {
            let scaled = serde_json::to_value(adapt(&original, 100, target).unwrap()).unwrap();
            assert_eq!(scaled["fromX"], target);
            assert_eq!(scaled["toY"], target * 4);
            assert_eq!(scaled["durationMs"], 500);
        }
        assert_eq!(serde_json::to_value(original).unwrap()["fromX"], 100);
    }
    #[test]
    fn regions_scale_but_invalid_scale_is_rejected() {
        let action: Action=serde_json::from_value(json!({"type":"capture","target":"A","region":{"x":10,"y":20,"width":100,"height":200},"name":"test"})).unwrap();
        assert_eq!(
            serde_json::to_value(adapt(&action, 100, 150).unwrap()).unwrap()["region"],
            json!({"x":15,"y":30,"width":150,"height":300})
        );
        assert!(adapt(&action, 0, 150).is_err());
    }
}
