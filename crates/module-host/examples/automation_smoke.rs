use moligod_module_host::ModuleClient;
use serde_json::{json, Value};
use std::{
    path::PathBuf,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
fn main() {
    let root =
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../bundled-modules/dev/automation");
    let temp = tempfile::tempdir().unwrap();
    let events = Arc::new(Mutex::new(Vec::<Value>::new()));
    let received = events.clone();
    let mut module = ModuleClient::new(
        "automation",
        root,
        temp.path().join("override"),
        temp.path().join("data"),
        move |name, data| {
            if name == "automation-state" {
                received.lock().unwrap().push(data);
            }
        },
    );
    assert!(module.info().installed);
    assert!(!module.is_started());
    module.call("validate", json!({"schemaVersion":1,"name":"window compatibility","steps":[
        {"annotation":"窗口设置注解","action":{"type":"setWindow","target":"A","title":"Example"}},
        {"action":{"type":"focus","target":"A"}}
    ]})).unwrap();
    let script = json!({"schemaVersion":1,"name":"IPC smoke","repeats":1,"maxRunSeconds":10,"startDelayMs":0,"steps":[
        {"action":{"type":"set","variable":"price","value":100}},
        {"action":{"type":"loop","count":3}},
        {"action":{"type":"calculate","variable":"price","expression":"price + 2"}},
        {"action":{"type":"endLoop"}},
        {"action":{"type":"assert","expression":"price == 106","message":"calculation"}}
    ]});
    module.call("validate", script.clone()).unwrap();
    let saved = module.call("save", script.clone()).unwrap();
    assert_eq!(
        module.call("load", saved["id"].clone()).unwrap()["name"],
        "IPC smoke"
    );
    module
        .call("start", json!({"script":script,"bindings":{}}))
        .unwrap();
    let deadline = Instant::now() + Duration::from_secs(5);
    loop {
        let status = module.call("status", Value::Null).unwrap();
        if status["running"] == false {
            assert_eq!(status["phase"], "completed");
            assert_eq!(status["variables"]["price"], json!(106.0));
            break;
        }
        assert!(Instant::now() < deadline);
        std::thread::sleep(Duration::from_millis(10));
    }
    let waiting =
        json!({"schemaVersion":1,"name":"cancel","steps":[{"action":{"type":"wait","ms":60000}}]});
    module
        .call("start", json!({"script":waiting,"bindings":{}}))
        .unwrap();
    let start = Instant::now();
    assert_eq!(
        module.call("stop", Value::Null).unwrap()["phase"],
        "stopped"
    );
    assert!(start.elapsed() < Duration::from_secs(2));
    let invalid = json!({"schemaVersion":1,"name":"invalid","steps":[{"action":{"type":"else"}}]});
    assert!(module.call("validate", invalid).is_err());
    assert!(events.lock().unwrap().len() >= 2);
    module.shutdown();
    assert!(!module.is_started());
    println!("PASS: automation module handshake, validation, script persistence, execution/variables/events, cancellation and shutdown.");
}
