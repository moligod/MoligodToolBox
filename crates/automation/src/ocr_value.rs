use serde_json::{json, Value};

/// Convert an OCR result using the action's persisted output mode.
pub fn format_result(
    text: &str,
    numbers_only: bool,
    numeric_result: bool,
) -> Result<Value, String> {
    let text: String = if numbers_only {
        text.chars()
            .filter(|c| c.is_ascii_digit() || *c == '.' || *c == '-')
            .collect()
    } else {
        text.to_owned()
    };
    if !numbers_only || !numeric_result {
        return Ok(json!(text));
    }
    if !text.chars().any(|c| c.is_ascii_digit()) {
        return Ok(Value::Null);
    }
    let number: f64 = text
        .parse()
        .map_err(|_| "识别结果不是有效数字，请检查识别区域".to_string())?;
    if !number.is_finite() || number.abs() > 9_007_199_254_740_991.0 {
        return Err("识别的数字超出可表示范围".into());
    }
    if number.fract() == 0.0 {
        Ok(json!(number as i64))
    } else {
        Ok(json!(number))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn integer_results_serialize_without_a_fraction() {
        for (text, expected) in [
            ("587", "587"),
            ("001", "1"),
            ("0", "0"),
            ("-0", "0"),
            ("-587", "-587"),
            ("587.0", "587"),
            ("9007199254740991", "9007199254740991"),
            ("-9007199254740991", "-9007199254740991"),
        ] {
            let result = format_result(text, true, true).unwrap();
            assert!(result.is_i64(), "{text}: {result}");
            assert_eq!(result.to_string(), expected);
        }
    }

    #[test]
    fn filters_and_converts_without_conflating_empty_and_zero() {
        for (text, expected) in [
            ("价格 785", json!(785)),
            ("-1.5", json!(-1.5)),
            ("001", json!(1)),
            ("0", json!(0)),
            ("文字", Value::Null),
            ("-.", Value::Null),
        ] {
            assert_eq!(format_result(text, true, true).unwrap(), expected);
        }
        assert_eq!(
            format_result("价格 001", true, false).unwrap(),
            json!("001")
        );
        assert_eq!(
            format_result("价格 001", false, true).unwrap(),
            json!("价格 001")
        );
        for text in ["1.2.3", "1-2", "9".repeat(400).as_str(), "9007199254740992"] {
            assert!(format_result(text, true, true).is_err(), "{text}");
        }
    }
}
