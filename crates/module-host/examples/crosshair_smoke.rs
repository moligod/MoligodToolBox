use moligod_module_host::ModuleClient;
use serde_json::{json, Value};
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    },
};
fn main() {
    let profile = if std::env::args().any(|arg| arg == "--release-module") {
        "release"
    } else {
        "dev"
    };
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join(format!("../../bundled-modules/{profile}/crosshair"));
    let temp = tempfile::tempdir().unwrap();
    let events = Arc::new(AtomicUsize::new(0));
    let received = events.clone();
    let mut module = ModuleClient::new(
        "crosshair",
        root,
        temp.path().join("override"),
        temp.path().join("images"),
        move |_, _| {
            received.fetch_add(1, Ordering::Relaxed);
        },
    );
    assert!(module.info().installed);
    assert!(!module.is_started());
    assert_eq!(
        module.call("status", Value::Null).unwrap()["running"],
        false
    );
    let pid = module.info().process_id.unwrap();
    if std::env::args().any(|arg| arg == "--abrupt") {
        println!("CHILD_PID={pid}");
        std::process::exit(0);
    }
    let mut config = moligod_core::config::Crosshair {
        hotkey: Some(119),
        ..Default::default()
    };
    assert_eq!(
        module.call("start", json!(config)).unwrap()["visible"],
        true
    );
    assert_eq!(module.call("hide", Value::Null).unwrap()["visible"], false);
    config.hotkey_mode = moligod_core::config::HotkeyMode::Hold;
    assert_eq!(
        module.call("apply", json!(config)).unwrap()["visible"],
        true
    );
    config.hotkey_mode = moligod_core::config::HotkeyMode::HoldShow;
    assert_eq!(
        module.call("apply", json!(config)).unwrap()["visible"],
        false
    );
    config.size = 32;
    assert_eq!(
        module.call("apply", json!(config)).unwrap()["visible"],
        false
    );
    if std::env::args().any(|arg| arg == "--hold") {
        let before = module.call("status", Value::Null).unwrap();
        println!("HOST_PID={} CHILD_PID={pid}", std::process::id());
        std::thread::sleep(std::time::Duration::from_secs(30));
        assert_eq!(
            module.call("status", Value::Null).unwrap()["drawCount"],
            before["drawCount"]
        );
    }
    config.hotkey = None;
    assert_eq!(
        module.call("apply", json!(config)).unwrap()["visible"],
        true
    );
    assert!(module.call("unknown", Value::Null).is_err());
    assert_eq!(module.call("status", Value::Null).unwrap()["running"], true);
    module.shutdown();
    assert!(!module.is_started());
    assert!(!module
        .call("monitors", Value::Null)
        .unwrap()
        .as_array()
        .unwrap()
        .is_empty());
    assert_ne!(module.info().process_id.unwrap(), pid);
    module.shutdown();
    assert!(events.load(Ordering::Relaxed) > 0);
    println!("PASS: installed discovery, lazy start, real crosshair RPC/events, all trigger modes, invalid operation, shutdown and restart.");
}
