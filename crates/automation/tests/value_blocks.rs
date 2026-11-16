use moligod_automation::{
    engine::{Driver, Plan},
    model::*,
};
use moligod_core::task::Cancellation;
use serde_json::{json, Value};
use std::time::{Duration, Instant};

#[derive(Default)]
struct Queries {
    calls: usize,
    slow: bool,
}
impl Driver for Queries {
    fn perform(
        &mut self,
        action: &Action,
        _: &Bindings,
        cancel: &Cancellation,
    ) -> Result<Option<(String, Value)>, String> {
        self.calls += 1;
        if self.slow {
            cancel.wait(Duration::from_secs(5));
            return Err("查询已取消".into());
        }
        match action {
            Action::Match { variable, .. } => Ok(Some((variable.clone(), json!(self.calls >= 3)))),
            Action::Ocr { variable, .. } => Ok(Some((variable.clone(), json!("实时文字")))),
            _ => panic!("unexpected native input"),
        }
    }
}
fn plan(steps: Value) -> Plan {
    Plan::compile(
        serde_json::from_value(
            json!({"schemaVersion":2,"name":"test","maxRunSeconds":5,"steps":steps}),
        )
        .unwrap(),
    )
    .unwrap()
}
fn numeric_plan(steps: Value) -> Plan {
    Plan::compile(
        serde_json::from_value(
            json!({"schemaVersion":3,"name":"test","maxRunSeconds":5,"steps":steps}),
        )
        .unwrap(),
    )
    .unwrap()
}
fn query() -> Value {
    json!({"kind":"query","action":{"type":"match","target":"A","region":{"x":0,"y":0,"width":10,"height":10},"template":"a".repeat(64),"threshold":0.9,"variable":"query_result","savePosition":false}})
}
fn hold(condition: Value, timeout: u32) -> Value {
    json!({"action":{"type":"holdUntil","expression":"false","timeoutMs":timeout,"intervalMs":100},"inputs":{"schemaVersion":1,"values":{"expression":condition}}})
}

#[test]
fn fixed_fixture_runs_nested_arithmetic_waits_and_literal_text() {
    let script: Script = serde_json::from_str(include_str!(
        "../../../tests/fixtures/automation-values-v2.json"
    ))
    .unwrap();
    let status = Plan::compile(script)
        .unwrap()
        .run(
            &mut Queries::default(),
            &Bindings::new(),
            &Cancellation::default(),
            |_| {},
        )
        .unwrap();
    assert_eq!(status.variables["total"], 9.0);
    assert_eq!(status.notice.as_deref(), Some("嵌套完成 ${这是文字}"));
    assert_eq!(status.phase, "completed");
}
#[test]
fn hold_queries_fresh_without_assigning_hidden_variables_and_short_circuits() {
    let mut driver = Queries::default();
    let status = plan(json!([hold(query(), 1000)]))
        .run(
            &mut driver,
            &Bindings::new(),
            &Cancellation::default(),
            |_| {},
        )
        .unwrap();
    assert_eq!(driver.calls, 3);
    assert!(status.variables.is_empty());
    let condition =
        json!({"kind":"binary","op":"||","left":{"kind":"literal","value":true},"right":query()});
    plan(json!([hold(condition, 1000)]))
        .run(
            &mut driver,
            &Bindings::new(),
            &Cancellation::default(),
            |_| {},
        )
        .unwrap();
    assert_eq!(driver.calls, 3);
}
#[test]
fn query_deadline_interrupts_native_work_and_parent_cancellation_wakes_wait() {
    let started = Instant::now();
    let error = plan(json!([hold(query(), 100)]))
        .run(
            &mut Queries {
                slow: true,
                ..Default::default()
            },
            &Bindings::new(),
            &Cancellation::default(),
            |_| {},
        )
        .unwrap_err();
    assert_eq!(error, "等待条件超时");
    assert!(started.elapsed() < Duration::from_secs(1));
    let token = Cancellation::default();
    let child = token.clone();
    let worker = std::thread::spawn(move || {
        plan(json!([hold(json!({"kind":"literal","value":false}), 5000)]))
            .run(&mut Queries::default(), &Bindings::new(), &child, |_| {})
            .unwrap()
    });
    std::thread::sleep(Duration::from_millis(30));
    token.cancel();
    assert_eq!(worker.join().unwrap().phase, "stopped");
}
#[test]
fn types_versions_unknown_slots_and_query_actions_are_rejected_before_running() {
    let step = hold(json!({"kind":"literal","value":1}), 1000);
    for change in ["type", "version", "slot", "action"] {
        let mut step = step.clone();
        match change {
            "version" => step["inputs"]["schemaVersion"] = json!(2),
            "slot" => {
                step["inputs"]["values"] = json!({"unknown":{"kind":"literal","value":true}});
            }
            "action" => {
                step["inputs"]["values"]["expression"] =
                    json!({"kind":"query","action":{"type":"notify","text":"side effect"}})
            }
            _ => {}
        }
        let script: Script =
            serde_json::from_value(json!({"schemaVersion":2,"name":"test","steps":[step]}))
                .unwrap();
        assert!(Plan::compile(script).is_err(), "{change}");
    }
    let mut script: Value = serde_json::from_str(include_str!(
        "../../../tests/fixtures/automation-values-v2.json"
    ))
    .unwrap();
    script["schemaVersion"] = json!(1);
    assert!(Plan::compile(serde_json::from_value(script).unwrap()).is_err());
}

#[test]
fn repeat_checks_fresh_queries_after_its_body_and_skips_unused_branches() {
    let mut repeat = hold(query(), 1000);
    repeat["action"]["type"] = json!("waitUntil");
    let mut driver = Queries::default();
    plan(json!([repeat,{"action":{"type":"endWaitUntil"}}]))
        .run(
            &mut driver,
            &Bindings::new(),
            &Cancellation::default(),
            |_| {},
        )
        .unwrap();
    assert_eq!(driver.calls, 3);
    let branch = json!({"action":{"type":"elseIf","expression":"false"},"inputs":{"schemaVersion":1,"values":{"expression":query()}}});
    plan(json!([{"action":{"type":"if","expression":"true"}},branch,{"action":{"type":"endIf"}}]))
        .run(
            &mut driver,
            &Bindings::new(),
            &Cancellation::default(),
            |_| {},
        )
        .unwrap();
    assert_eq!(driver.calls, 3);
}

#[test]
fn query_text_feeds_action_without_variable_assignment_and_wrong_variable_type_fails() {
    let input = json!({"kind":"query","action":{"type":"ocr","target":"A","region":{"x":0,"y":0,"width":10,"height":10},"variable":"query_result","reuse":false}});
    let script = plan(
        json!([{"action":{"type":"notify","text":""},"inputs":{"schemaVersion":1,"values":{"text":input}}}]),
    );
    let status = script
        .run(
            &mut Queries::default(),
            &Bindings::new(),
            &Cancellation::default(),
            |_| {},
        )
        .unwrap();
    assert_eq!(status.notice.as_deref(), Some("实时文字"));
    assert!(status.variables.is_empty());
    let script = plan(json!([
        {"action":{"type":"set","variable":"seconds","value":"wrong"}},
        {"action":{"type":"wait","ms":0},"inputs":{"schemaVersion":1,"values":{"seconds":{"kind":"variable","name":"seconds","valueType":"number"}}}}
    ]));
    assert!(script
        .run(
            &mut Queries::default(),
            &Bindings::new(),
            &Cancellation::default(),
            |_| {}
        )
        .unwrap_err()
        .contains("类型不匹配"));
}

struct NumberOcr(&'static str);
impl Driver for NumberOcr {
    fn perform(
        &mut self,
        action: &Action,
        _: &Bindings,
        _: &Cancellation,
    ) -> Result<Option<(String, Value)>, String> {
        match action {
            Action::Ocr { variable, .. } => Ok(Some((variable.clone(), json!(self.0)))),
            _ => panic!("unexpected native input"),
        }
    }
}

#[test]
fn numeric_ocr_text_can_be_compared_without_changing_the_saved_text() {
    let script = plan(json!([
        {"action":{"type":"ocr","target":"A","region":{"x":0,"y":0,"width":10,"height":10},"variable":"result","reuse":false,"numbersOnly":true}},
        {"action":{"type":"if","expression":"false"},"inputs":{"schemaVersion":1,"values":{"expression":{"kind":"binary","op":"<","left":{"kind":"variable","name":"result","valueType":"number"},"right":{"kind":"literal","value":785}}}}},
        {"action":{"type":"set","variable":"matched","value":true}},
        {"action":{"type":"endIf"}}
    ]));
    for (text, matched) in [("785", false), ("784", true), ("  -1.5  ", true)] {
        let status = script
            .run(
                &mut NumberOcr(text),
                &Bindings::new(),
                &Cancellation::default(),
                |_| {},
            )
            .unwrap();
        assert_eq!(status.variables["result"], json!(text));
        assert_eq!(status.variables.contains_key("matched"), matched);
    }
    for text in ["", "abc", "12.3.4", "NaN", "inf"] {
        let error = script
            .run(
                &mut NumberOcr(text),
                &Bindings::new(),
                &Cancellation::default(),
                |_| {},
            )
            .unwrap_err();
        assert!(error.contains("类型不匹配"), "{text}: {error}");
        assert!(error.contains(if text.is_empty() {
            "数字文字为空"
        } else {
            "文字不是有效数字"
        }));
    }
}

#[test]
fn failed_numeric_comparison_publishes_the_latest_ocr_result() {
    let script = plan(json!([
        {"action":{"type":"ocr","target":"A","region":{"x":0,"y":0,"width":10,"height":10},"variable":"result","reuse":false,"numbersOnly":true}},
        {"action":{"type":"if","expression":"false"},"inputs":{"schemaVersion":1,"values":{"expression":{"kind":"binary","op":"<","left":{"kind":"variable","name":"result","valueType":"number"},"right":{"kind":"literal","value":785}}}}},
        {"action":{"type":"endIf"}}
    ]));
    let mut latest = None;
    let error = script
        .run(
            &mut NumberOcr(""),
            &Bindings::new(),
            &Cancellation::default(),
            |status| latest = Some(status),
        )
        .unwrap_err();
    assert!(error.contains("类型不匹配"));
    assert_eq!(latest.unwrap().variables.get("result"), Some(&json!("")));
}

#[test]
fn selector_values_adapt_variables_to_numeric_text_boolean_and_any_slots() {
    let selector = |mode: &str, value: Value| json!({"kind":"selector","mode":mode,"value":value});
    let input = |key: &str, value: Value| json!({"schemaVersion":2,"values":{(key):value}});
    let script = plan(json!([
        {"action":{"type":"set","variable":"n","value":7}},
        {"action":{"type":"set","variable":"ready","value":true}},
        {"action":{"type":"set","variable":"copy","value":null},"inputs":input("value",selector("variable",json!("n")))},
        {"action":{"type":"set","variable":"message","value":null},"inputs":input("value",selector("string",json!("你好")))},
        {"action":{"type":"if","expression":""},"inputs":input("expression",json!({"kind":"binary","op":"<","left":selector("variable",json!("n")),"right":selector("number",json!(10))}))},
        {"action":{"type":"set","variable":"matched","value":true}},
        {"action":{"type":"endIf"}},
        {"action":{"type":"if","expression":""},"inputs":input("expression",selector("variable",json!("ready")))},
        {"action":{"type":"notify","text":""},"inputs":input("text",selector("variable",json!("n")))},
        {"action":{"type":"endIf"}}
    ]));
    let status = script
        .run(
            &mut Queries::default(),
            &Bindings::new(),
            &Cancellation::default(),
            |_| {},
        )
        .unwrap();
    assert_eq!(status.variables["copy"], json!(7));
    assert_eq!(status.variables["message"], json!("你好"));
    assert_eq!(status.variables["matched"], json!(true));
    assert_eq!(status.notice.as_deref(), Some("7"));
}

#[test]
fn automatic_variable_arithmetic_and_equality_preserve_values() {
    let selector = |mode: &str, value: Value| json!({"kind":"selector","mode":mode,"value":value});
    let variable = || selector("variable", json!("result"));
    let set_expr = |name: &str, op: &str, left: Value, right: Value| {
        json!({
            "action":{"type":"set","variable":name,"value":null},
            "inputs":{"schemaVersion":3,"values":{"value":{"kind":"binary","op":op,"left":left,"right":right,"strictEquality":true}}}
        })
    };
    let script = plan(json!([
        {"action":{"type":"set","variable":"result","value":"001"}},
        set_expr("sum", "+", variable(), selector("number", json!(1))),
        set_expr("is_number", "==", variable(), selector("number", json!(1))),
        set_expr("is_other_text", "==", variable(), selector("string", json!("1"))),
        set_expr("is_same_text", "==", variable(), selector("string", json!("001"))),
        set_expr("is_different", "!=", variable(), selector("number", json!(1))),
        set_expr("same_number", "==", selector("number", json!(1)), selector("number", json!(1.0))),
        {"action":{"type":"set","variable":"legacy","value":null},"inputs":{"schemaVersion":1,"values":{"value":{"kind":"binary","op":"==","left":{"kind":"variable","name":"result","valueType":"any"},"right":{"kind":"literal","value":1}}}}},
        {"action":{"type":"set","variable":"legacy_selector","value":null},"inputs":{"schemaVersion":2,"values":{"value":{"kind":"binary","op":"==","left":{"kind":"selector","mode":"variable","value":"result"},"right":{"kind":"selector","mode":"number","value":1}}}}}
    ]));
    let status = script
        .run(
            &mut Queries::default(),
            &Bindings::new(),
            &Cancellation::default(),
            |_| {},
        )
        .unwrap();
    assert_eq!(status.variables["result"], json!("001"));
    assert_eq!(status.variables["sum"], json!(2.0));
    assert_eq!(status.variables["is_number"], json!(false));
    assert_eq!(status.variables["is_other_text"], json!(false));
    assert_eq!(status.variables["is_same_text"], json!(true));
    assert_eq!(status.variables["is_different"], json!(true));
    assert_eq!(status.variables["same_number"], json!(true));
    assert_eq!(status.variables["legacy"], json!(true));
    assert_eq!(status.variables["legacy_selector"], json!(true));
}

#[test]
fn selector_requires_version_two_and_rejects_invalid_values_or_future_versions() {
    for (version, selector) in [
        (1, json!({"kind":"selector","mode":"number","value":1})),
        (2, json!({"kind":"selector","mode":"number","value":"abc"})),
        (
            2,
            json!({"kind":"selector","mode":"variable","value":"bad name"}),
        ),
        (4, json!({"kind":"selector","mode":"number","value":1})),
    ] {
        let script: Script = serde_json::from_value(json!({"schemaVersion":2,"name":"test","steps":[
            {"action":{"type":"set","variable":"result","value":null},"inputs":{"schemaVersion":version,"values":{"value":selector}}}
        ]})).unwrap();
        assert!(Plan::compile(script).is_err(), "version {version}");
    }
    let invalid: Script = serde_json::from_value(json!({"schemaVersion":2,"name":"test","steps":[
        {"action":{"type":"set","variable":"result","value":null},"inputs":{"schemaVersion":2,"values":{"value":{"kind":"binary","op":"==","left":{"kind":"literal","value":1},"right":{"kind":"literal","value":1},"strictEquality":true}}}}
    ]})).unwrap();
    assert!(Plan::compile(invalid).is_err());
}

#[test]
fn selector_variable_uses_ocr_digit_text_in_numeric_comparison() {
    let script = plan(json!([
        {"action":{"type":"ocr","target":"A","region":{"x":0,"y":0,"width":10,"height":10},"variable":"result","reuse":false,"numbersOnly":true}},
        {"action":{"type":"if","expression":""},"inputs":{"schemaVersion":2,"values":{"expression":{"kind":"binary","op":"<","left":{"kind":"selector","mode":"variable","value":"result"},"right":{"kind":"selector","mode":"number","value":785}}}}},
        {"action":{"type":"set","variable":"matched","value":true}},
        {"action":{"type":"endIf"}},
        {"action":{"type":"notify","text":""},"inputs":{"schemaVersion":2,"values":{"text":{"kind":"selector","mode":"variable","value":"result"}}}}
    ]));
    let status = script
        .run(
            &mut NumberOcr("784"),
            &Bindings::new(),
            &Cancellation::default(),
            |_| {},
        )
        .unwrap();
    assert_eq!(status.variables["matched"], json!(true));
    assert_eq!(status.notice.as_deref(), Some("784"));
    assert_eq!(status.variables["result"], json!("784"));
    assert!(script
        .run(
            &mut NumberOcr(""),
            &Bindings::new(),
            &Cancellation::default(),
            |_| {}
        )
        .unwrap_err()
        .contains("数字文字为空"));
}

struct OcrResult(&'static str);
impl Driver for OcrResult {
    fn perform(
        &mut self,
        action: &Action,
        _: &Bindings,
        _: &Cancellation,
    ) -> Result<Option<(String, Value)>, String> {
        match action {
            Action::Ocr {
                variable,
                numbers_only,
                numeric_result,
                ..
            } => Ok(Some((
                variable.clone(),
                moligod_automation::ocr_value::format_result(
                    self.0,
                    *numbers_only,
                    *numeric_result,
                )?,
            ))),
            _ => panic!("unexpected native input"),
        }
    }
}

#[test]
fn numeric_ocr_results_work_in_variables_queries_and_empty_guards() {
    let ocr = json!({"type":"ocr","target":"A","region":{"x":0,"y":0,"width":10,"height":10},"variable":"result","reuse":false,"numbersOnly":true,"numericResult":true});
    let mislabeled: Script =
        serde_json::from_value(json!({"schemaVersion":2,"name":"test","steps":[{"action":ocr}]}))
            .unwrap();
    assert!(Plan::compile(mislabeled)
        .err()
        .unwrap()
        .contains("脚本版本3"));
    let result = json!({"kind":"selector","mode":"variable","value":"result"});
    let compare = |op: &str, left: Value, right: Value| json!({"kind":"binary","op":op,"left":left,"right":right,"strictEquality":true});
    let input = |value: Value| json!({"schemaVersion":3,"values":{"expression":value}});
    let script = numeric_plan(json!([
        {"action":ocr},
        {"action":{"type":"if","expression":""},"inputs":input(compare("&&", compare("!=",result.clone(),json!({"kind":"literal","value":null})), compare("==",result.clone(),json!({"kind":"selector","mode":"number","value":785}))))},
        {"action":{"type":"set","variable":"matched","value":true}},
        {"action":{"type":"endIf"}}
    ]));
    for (text, expected, matched) in [
        ("价格785", json!(785), true),
        ("0", json!(0), false),
        ("没有", Value::Null, false),
    ] {
        let status = script
            .run(
                &mut OcrResult(text),
                &Bindings::new(),
                &Cancellation::default(),
                |_| {},
            )
            .unwrap();
        assert_eq!(status.variables["result"], expected);
        assert_eq!(status.variables.contains_key("matched"), matched);
    }
    assert!(script
        .run(
            &mut OcrResult("1.2.3"),
            &Bindings::new(),
            &Cancellation::default(),
            |_| {}
        )
        .unwrap_err()
        .contains("不是有效数字"));
    let legacy = plan(
        json!([{ "action": {"type":"ocr","target":"A","region":{"x":0,"y":0,"width":10,"height":10},"variable":"result","reuse":false,"numbersOnly":true}}]),
    );
    let status = legacy
        .run(
            &mut OcrResult("001"),
            &Bindings::new(),
            &Cancellation::default(),
            |_| {},
        )
        .unwrap();
    assert_eq!(status.variables["result"], json!("001"));
    let query = numeric_plan(json!([
        {"action":{"type":"if","expression":""},"inputs":{"schemaVersion":2,"values":{"expression":{"kind":"binary","op":"<","left":{"kind":"query","action":ocr},"right":{"kind":"literal","value":800}}}}},
        {"action":{"type":"set","variable":"query_matched","value":true}},
        {"action":{"type":"endIf"}}
    ]));
    let status = query
        .run(
            &mut OcrResult("785"),
            &Bindings::new(),
            &Cancellation::default(),
            |_| {},
        )
        .unwrap();
    assert_eq!(status.variables["query_matched"], json!(true));
    assert!(query
        .run(
            &mut OcrResult("没有"),
            &Bindings::new(),
            &Cancellation::default(),
            |_| {}
        )
        .unwrap_err()
        .contains("识别结果为空"));
}

#[test]
fn integer_ocr_results_display_and_compare_in_saved_typed_and_auto_variables() {
    for left in [
        json!({"kind":"variable","name":"result","valueType":"number"}),
        json!({"kind":"selector","mode":"variable","value":"result"}),
    ] {
        let mut steps = vec![json!({
            "action": {
                "type": "ocr", "target": "A",
                "region": {"x":0,"y":0,"width":10,"height":10},
                "variable": "result", "numbersOnly": true, "numericResult": true
            }
        })];
        for (index, op) in ["<", ">", "<=", ">=", "==", "!="].into_iter().enumerate() {
            steps.push(json!({
                "action": {"type":"set","variable":format!("comparison_{index}"),"value":null},
                "inputs": {
                    "schemaVersion": 3,
                    "values": {"value": {
                        "kind": "binary", "op": op, "left": left,
                        "right": {"kind":"literal","value":450}, "strictEquality": true
                    }}
                }
            }));
        }
        steps.push(json!({
            "action": {"type":"notify","text":""},
            "inputs": {
                "schemaVersion": 2,
                "values": {"text": {"kind":"selector","mode":"variable","value":"result"}}
            }
        }));
        let script = numeric_plan(json!(steps));
        for (text, expected, comparisons) in [
            ("587", "587", [false, true, false, true, false, true]),
            ("450", "450", [false, false, true, true, true, false]),
            ("0", "0", [true, false, true, false, false, true]),
            ("587.5", "587.5", [false, true, false, true, false, true]),
        ] {
            let status = script
                .run(
                    &mut OcrResult(text),
                    &Bindings::new(),
                    &Cancellation::default(),
                    |_| {},
                )
                .unwrap();
            for (index, matched) in comparisons.into_iter().enumerate() {
                assert_eq!(status.variables[&format!("comparison_{index}")], matched);
            }
            assert_eq!(status.notice.as_deref(), Some(expected));
            assert!(status
                .logs
                .iter()
                .any(|line| line == &format!("提示：{expected}")));
        }
    }
}

#[test]
fn legacy_text_branch_after_numeric_ocr_comparison_accepts_numbers() {
    let script = numeric_plan(json!([
        {"action": {
            "type": "ocr", "target": "A",
            "region": {"x":0,"y":0,"width":10,"height":10},
            "variable": "result", "numbersOnly": true, "numericResult": true
        }},
        {
            "action": {"type":"notify","text":""},
            "inputs": {
                "schemaVersion": 2,
                "values": {"text": {"kind":"selector","mode":"variable","value":"result"}}
            }
        },
        {
            "action": {"type":"if","expression":""},
            "inputs": {
                "schemaVersion": 1,
                "values": {"expression": {
                    "kind": "binary", "op": "<",
                    "left": {"kind":"variable","name":"result","valueType":"number"},
                    "right": {"kind":"literal","value":450}
                }}
            }
        },
        {"action": {"type":"set","variable":"below_limit","value":true}},
        {
            "action": {"type":"elseIf","expression":""},
            "inputs": {
                "schemaVersion": 1,
                "values": {"expression": {
                    "kind": "binary", "op": "==",
                    "left": {"kind":"variable","name":"result","valueType":"string"},
                    "right": {"kind":"literal","value":""}
                }}
            }
        },
        {"action": {"type":"set","variable":"empty_result","value":true}},
        {"action": {"type":"endIf"}}
    ]));
    for (text, below_limit) in [
        ("587", false),
        ("450", false),
        ("449", true),
        ("0", true),
        ("587.5", false),
    ] {
        let status = script
            .run(
                &mut OcrResult(text),
                &Bindings::new(),
                &Cancellation::default(),
                |_| {},
            )
            .unwrap();
        assert_eq!(status.phase, "completed");
        assert_eq!(status.variables.contains_key("below_limit"), below_limit);
        assert!(!status.variables.contains_key("empty_result"));
    }
}
