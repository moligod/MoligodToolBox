use moligod_automation::{
    engine::Driver,
    model::*,
    native::{capture, NativeDriver},
};
use moligod_core::task::Cancellation;
use std::sync::atomic::{AtomicIsize, Ordering};
use std::{
    collections::BTreeMap,
    ptr::{null, null_mut},
    sync::mpsc,
    time::Duration,
};
use windows_sys::Win32::{
    Foundation::*,
    Graphics::Gdi::*,
    System::Threading::GetCurrentProcessId,
    UI::{HiDpi::*, WindowsAndMessaging::*},
};
static EDIT_PROC: AtomicIsize = AtomicIsize::new(0);
static LAST_CLICK: AtomicIsize = AtomicIsize::new(-1);
const EM_SETSEL: u32 = 0x00B1;
unsafe extern "system" fn fixture_proc(hwnd: HWND, message: u32, w: WPARAM, l: LPARAM) -> LRESULT {
    unsafe {
        if message == WM_LBUTTONDOWN {
            LAST_CLICK.store(l, Ordering::Relaxed);
        }
        // Classic EDIT does not implement Ctrl+A itself; make the fixture behave like modern editors.
        if message == WM_KEYDOWN
            && w == 65
            && windows_sys::Win32::UI::Input::KeyboardAndMouse::GetKeyState(17) < 0
        {
            SendMessageW(hwnd, EM_SETSEL, 0, -1);
            return 0;
        }
        CallWindowProcW(
            Some(std::mem::transmute::<
                isize,
                unsafe extern "system" fn(HWND, u32, WPARAM, LPARAM) -> LRESULT,
            >(EDIT_PROC.load(Ordering::Relaxed))),
            hwnd,
            message,
            w,
            l,
        )
    }
}

fn main() {
    let (send, ready) = mpsc::channel();
    let ui = std::thread::spawn(move || unsafe {
        SetThreadDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
        let class: Vec<u16> = "EDIT\0".encode_utf16().collect();
        let title: Vec<u16> = "MOLIGOD 12345\0".encode_utf16().collect();
        let hwnd = CreateWindowExW(
            WS_EX_TOOLWINDOW,
            class.as_ptr(),
            title.as_ptr(),
            WS_OVERLAPPEDWINDOW | WS_VISIBLE | ES_MULTILINE as u32,
            100,
            100,
            520,
            220,
            null_mut(),
            null_mut(),
            null_mut(),
            null(),
        );
        assert!(!hwnd.is_null());
        // The sampling launcher hides its console via STARTUPINFO. Explicitly
        // show the capture fixture after consuming the first ShowWindow override.
        ShowWindow(hwnd, SW_SHOWNOACTIVATE);
        ShowWindow(hwnd, SW_SHOWNOACTIVATE);
        EDIT_PROC.store(
            SetWindowLongPtrW(hwnd, GWLP_WNDPROC, fixture_proc as *const () as isize),
            Ordering::Relaxed,
        );
        let font_name: Vec<u16> = "Arial\0".encode_utf16().collect();
        let font = CreateFontW(
            -32,
            0,
            0,
            0,
            400,
            0,
            0,
            0,
            1,
            0,
            0,
            4,
            0,
            font_name.as_ptr(),
        );
        SendMessageW(hwnd, WM_SETFONT, font as usize, 1);
        UpdateWindow(hwnd);
        let mut rect: RECT = std::mem::zeroed();
        GetClientRect(hwnd, &mut rect);
        let cover_class: Vec<u16> = "STATIC\0".encode_utf16().collect();
        let cover_text: Vec<u16> = "OCCLUDER\0".encode_utf16().collect();
        let cover = CreateWindowExW(
            WS_EX_TOPMOST,
            cover_class.as_ptr(),
            cover_text.as_ptr(),
            WS_OVERLAPPEDWINDOW | WS_VISIBLE,
            80,
            80,
            600,
            300,
            null_mut(),
            null_mut(),
            null_mut(),
            null(),
        );
        assert!(!cover.is_null());
        SetForegroundWindow(cover);
        UpdateWindow(cover);
        send.send((
            BoundWindow {
                hwnd: hwnd as u64,
                pid: GetCurrentProcessId(),
                title: "smoke".into(),
                width: rect.right,
                height: rect.bottom,
            },
            cover as usize,
        ))
        .unwrap();
        let mut message: MSG = std::mem::zeroed();
        while GetMessageW(&mut message, null_mut(), 0, 0) > 0 {
            if message.message == WM_APP + 90 {
                break;
            }
            if message.message == WM_APP + 91 {
                ShowWindow(cover, SW_HIDE);
                SetForegroundWindow(hwnd);
                continue;
            }
            TranslateMessage(&message);
            DispatchMessageW(&message);
        }
        DestroyWindow(hwnd);
        DestroyWindow(cover);
        DeleteObject(font);
    });
    let (window, _cover) = ready.recv().unwrap();
    let id = window.hwnd as HWND;
    let result = (|| -> Result<(), String> {
        unsafe {
            SetThreadDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
        }
        let mut desktop_point = POINT { x: 35, y: 45 };
        assert_ne!(unsafe { ClientToScreen(id, &mut desktop_point) }, 0);
        assert_eq!(
            moligod_automation::native::client_point(&window, desktop_point)?,
            (35, 45)
        );
        let mut outside = POINT { x: -1, y: -1 };
        assert_ne!(unsafe { ClientToScreen(id, &mut outside) }, 0);
        assert!(moligod_automation::native::client_point(&window, outside).is_err());
        let temp = tempfile::tempdir().map_err(|e| e.to_string())?;
        let mut driver = NativeDriver::new(temp.path().into())?;
        let token = Cancellation::default();
        let region = Region {
            x: 0,
            y: 0,
            width: window.width as u32,
            height: window.height as u32,
        };
        if std::env::args().any(|arg| arg == "--capture-region") {
            let full = capture(&window, region, &token)?;
            let selected = Region {
                x: 120,
                y: 60,
                width: 140,
                height: 60,
            };
            let expected = image::imageops::crop_imm(
                &full,
                selected.x as u32,
                selected.y as u32,
                selected.width,
                selected.height,
            )
            .to_image();
            let actual = capture(&window, selected, &token)?;
            std::fs::create_dir_all("target/capture-region-qa").map_err(|e| e.to_string())?;
            full.save("target/capture-region-qa/full.png")
                .map_err(|e| e.to_string())?;
            expected
                .save("target/capture-region-qa/expected.png")
                .map_err(|e| e.to_string())?;
            actual
                .save("target/capture-region-qa/actual.png")
                .map_err(|e| e.to_string())?;
            let mismatches = expected
                .pixels()
                .zip(actual.pixels())
                .filter(|(a, b)| a != b)
                .count();
            if mismatches != 0 {
                return Err(format!("Selected-region capture differs from full-frame crop at {mismatches} pixels; region=(120,60,140,60)"));
            }
            println!(
                "PASS: selected-region capture matches full-frame crop at non-zero coordinates."
            );
            return Ok(());
        }
        if std::env::args().any(|arg| arg == "--module-ocr")
            || std::env::args().any(|arg| arg == "--module-ocr-snapshot")
            || std::env::args().any(|arg| arg == "--module-ocr-models")
            || std::env::args().any(|arg| arg == "--module-tasks")
            || std::env::args().any(|arg| arg == "--module-position")
        {
            let profile = if std::env::args().any(|arg| arg == "--release-module") {
                "release"
            } else {
                "dev"
            };
            let root = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join(format!("../../bundled-modules/{profile}/automation"));
            let mut module = moligod_module_host::ModuleClient::new(
                "automation",
                root,
                temp.path().join("override"),
                temp.path().join("module"),
                |_, _| {},
            );
            if std::env::args().any(|arg| arg == "--module-position") {
                use serde_json::{json, Value};
                let frame = capture(&window, region, &token)?;
                let template = image::imageops::crop_imm(&frame, 20, 5, 60, 35).to_image();
                let mut png = std::io::Cursor::new(Vec::new());
                template
                    .write_to(&mut png, image::ImageFormat::Png)
                    .map_err(|e| e.to_string())?;
                let template = moligod_automation::native::import_template(
                    png.get_ref(),
                    &temp.path().join("module"),
                )?;
                let scale = moligod_automation::native::window_scale(&window)?;
                let script = json!({"schemaVersion":1,"name":"position test","缩放":scale,"steps":[
                    {"action":{"type":"waitUntil","expression":"result != null","timeoutMs":3000,"intervalMs":100}},
                    {"action":{"type":"match","target":"A","region":{"x":10,"y":3,"width":180,"height":50},"template":template,"threshold":1,"variable":"result","savePosition":true}},
                    {"action":{"type":"endWaitUntil"}},
                    {"action":{"type":"click","target":"A","position":"result","x":-1,"y":-1,"mode":"background","button":"left","holdMs":30}}
                ]});
                module.call("start", json!({"script":script,"bindings":{"A":window}}))?;
                let deadline = std::time::Instant::now() + Duration::from_secs(10);
                loop {
                    let status = module.call("status", Value::Null)?;
                    if status["running"] == false {
                        assert_eq!(status["phase"], "completed", "{status}");
                        assert_eq!(
                            status["variables"]["result"],
                            json!({"x":50,"y":22,"scale":scale,"target":"A"})
                        );
                        break;
                    }
                    if std::time::Instant::now() > deadline {
                        return Err("position test timed out".into());
                    }
                    std::thread::sleep(Duration::from_millis(20));
                }
                assert_eq!(LAST_CLICK.load(Ordering::Relaxed), 50 | (22 << 16));
                module.shutdown();
                println!("PASS: {profile} module finds image center with ROI offset and passes position variable to background click at (50,22), without foreground input.");
                return Ok(());
            }
            if std::env::args().any(|arg| arg == "--module-ocr-snapshot") {
                let preview = module.call(
                    "preview",
                    serde_json::json!({"window":window,"fullWindow":true}),
                )?;
                let snapshot = preview["snapshot"]
                    .as_str()
                    .ok_or("Missing preview snapshot")?;
                let replacement: Vec<u16> = "CHANGED 98765\0".encode_utf16().collect();
                unsafe {
                    SetWindowTextW(id, replacement.as_ptr());
                    UpdateWindow(id);
                }
                let frozen = module.call(
                    "ocr-test",
                    serde_json::json!({"snapshot":snapshot,"region":region}),
                )?;
                let live = module.call(
                    "ocr-test",
                    serde_json::json!({"window":window,"region":region}),
                )?;
                if !frozen["text"].as_str().unwrap_or("").contains("12345")
                    || !live["text"].as_str().unwrap_or("").contains("98765")
                {
                    return Err(format!(
                        "Snapshot/live mismatch: frozen={frozen}, live={live}"
                    ));
                }
                let refreshed = module.call(
                    "preview",
                    serde_json::json!({"window":window,"fullWindow":true}),
                )?;
                if module
                    .call(
                        "ocr-test",
                        serde_json::json!({"snapshot":snapshot,"region":region}),
                    )
                    .is_ok()
                {
                    return Err("Expired preview was accepted".into());
                }
                let current = module.call(
                    "ocr-test",
                    serde_json::json!({"snapshot":refreshed["snapshot"],"region":region}),
                )?;
                if !current["text"].as_str().unwrap_or("").contains("98765") {
                    return Err(format!("Refresh did not change OCR source: {current}"));
                }
                println!("PASS: displayed preview OCR={frozen}; changed live window OCR={live}; explicit refresh OCR={current}; expired snapshot rejected.");
                module.shutdown();
                return Ok(());
            }
            if std::env::args().any(|arg| arg == "--module-ocr-models") {
                if let Some(path) = std::env::var_os("MOLIGOD_SMOKE_CAPTURE") {
                    capture(&window, region, &token)?
                        .save(path)
                        .map_err(|e| e.to_string())?;
                }
                let mut devices = vec!["cpu"];
                if std::env::args().any(|arg| arg == "--with-amd") {
                    devices.push("amd");
                }
                if std::env::args().any(|arg| arg == "--with-nvidia") {
                    devices.push("nvidia");
                }
                for device in devices {
                    for model in ["small", "tiny"] {
                        let settings =
                            serde_json::json!({"schemaVersion":1,"model":model,"device":device});
                        assert_eq!(
                            module.call("ocr-settings-save", settings.clone())?,
                            settings
                        );
                        assert_eq!(
                            module.call("ocr-settings", serde_json::Value::Null)?,
                            settings
                        );
                        let result = module.call(
                            "ocr-test",
                            serde_json::json!({"window":window,"region":region,"numbersOnly":true}),
                        )?;
                        assert_eq!(result["text"], "12345", "{model}/{device}: {result}");
                    }
                }
                module.shutdown();
                let settings = module.call("ocr-settings", serde_json::Value::Null)?;
                assert_eq!(settings["model"], "tiny");
                let script = serde_json::json!({"schemaVersion":1,"name":"models","repeats":1,"maxRunSeconds":150,"startDelayMs":0,"steps":[
                    {"action":{"type":"ocr","target":"A","region":region,"ocrModel":"small","variable":"small_result","reuse":true}},
                    {"action":{"type":"ocr","target":"A","region":region,"ocrModel":"tiny","variable":"tiny_result","reuse":true}},
                ]});
                module.call(
                    "start",
                    serde_json::json!({"script":script,"bindings":{"A":window}}),
                )?;
                let deadline = std::time::Instant::now() + Duration::from_secs(150);
                loop {
                    let status = module.call("status", serde_json::Value::Null)?;
                    if status["running"] == false {
                        assert_eq!(status["phase"], "completed", "{status}");
                        for key in ["small_result", "tiny_result"] {
                            assert!(
                                status["variables"][key].as_str().unwrap().contains("12345"),
                                "{key}: {status}"
                            );
                        }
                        break;
                    }
                    if std::time::Instant::now() >= deadline {
                        return Err("OCR model script did not finish".into());
                    }
                    std::thread::sleep(Duration::from_millis(50));
                }
                module.shutdown();
                println!("PASS: global OCR settings persist across restart; CPU/GPU small/tiny single-region tests and global-model script variables.");
                return Ok(());
            }

            if std::env::args().any(|arg| arg == "--module-tasks") {
                for (id, name) in [
                    ("12345678-1234-1234-1234-123456789abc", "task1"),
                    ("12345678-1234-1234-1234-123456789abd", "task2"),
                ] {
                    let script = serde_json::json!({"schemaVersion":1,"name":name,"repeats":1,"maxRunSeconds":10,"startDelayMs":0,"steps":[{"action":{"type":"wait","ms":10}}]});
                    module.call("task-save",serde_json::json!({"schemaVersion":2,"id":id,"name":name,"intervalMs":100,"script":script}))?;
                    module.call("task-start", serde_json::json!({"id":id,"bindings":{}}))?;
                }
                let states = module.call("task-statuses", serde_json::Value::Null)?;
                assert_eq!(states.as_object().unwrap().len(), 2);
                assert!(states
                    .as_object()
                    .unwrap()
                    .values()
                    .all(|v| v["running"] == true));
                module.call(
                    "task-stop",
                    serde_json::json!("12345678-1234-1234-1234-123456789abc"),
                )?;
                let states = module.call("task-statuses", serde_json::Value::Null)?;
                assert_eq!(
                    states["12345678-1234-1234-1234-123456789abc"]["running"],
                    false
                );
                assert_eq!(
                    states["12345678-1234-1234-1234-123456789abd"]["running"],
                    true
                );
                module.call("task-stop-all", serde_json::Value::Null)?;
                let states = module.call("task-statuses", serde_json::Value::Null)?;
                assert!(states
                    .as_object()
                    .unwrap()
                    .values()
                    .all(|v| v["running"] == false));
                module.shutdown();
                let saved = module.call("task-list", serde_json::Value::Null)?;
                assert_eq!(
                    saved.as_array().unwrap().len(),
                    2,
                    "saved tasks must survive module restart"
                );
                assert!(saved
                    .as_array()
                    .unwrap()
                    .iter()
                    .all(|row| row.get("source").is_none()));
                assert!(module
                    .call("task-statuses", serde_json::Value::Null)?
                    .as_object()
                    .unwrap()
                    .is_empty());
                module.shutdown();
                println!("PASS: two windowless task runners, stop one and stop all, persistence after restart.");
                return Ok(());
            }
            for i in 0..5 {
                let payload = serde_json::json!({"window":window,"region":region});
                module.call("preview", payload.clone())?;
                let result = module.call("ocr-test", payload)?;
                assert!(
                    result["text"].as_str().unwrap().contains("12345"),
                    "{result}"
                );
                println!("PASS: module preview/OCR round {i}");
            }
            module.shutdown();
            return Ok(());
        }
        let foreground = unsafe { GetForegroundWindow() };
        assert_ne!(foreground, id, "fixture must be in the background");
        let image = capture(&window, region, &token)?;
        assert_eq!(
            unsafe { GetForegroundWindow() },
            foreground,
            "capture must not steal focus"
        );
        let recognized = driver.recognize(&image, &token)?;
        assert!(recognized.contains("12345"), "OCR result: {recognized}");
        println!(
            "PASS: WGC captures occluded background client content without changing foreground."
        );
        if !std::env::args().any(|arg| arg == "--with-input") {
            let updated: Vec<u16> = "FRESH 67890\0".encode_utf16().collect();
            unsafe {
                SendMessageW(id, WM_SETTEXT, 0, updated.as_ptr() as LPARAM);
                UpdateWindow(id);
            }
            let fresh = capture(&window, region, &token)?;
            assert!(driver.recognize(&fresh, &token)?.contains("67890"));
            assert_eq!(unsafe { GetForegroundWindow() }, foreground);
            let invalid = Region {
                x: window.width,
                y: 0,
                width: 1,
                height: 1,
            };
            assert!(capture(&window, invalid, &token).is_err());
            println!("PASS: repeated capture returns new pixels; out-of-client region rejected.");
            return Ok(());
        }
        unsafe {
            PostMessageW(id, WM_APP + 91, 0, 0);
        }
        std::thread::sleep(Duration::from_millis(100));
        let bindings = BTreeMap::from([(Slot::A, window.clone())]);
        driver.perform(
            &Action::Key {
                target: Some(Slot::A),
                keys: vec![17, 65],
                hold_ms: 20,
            },
            &bindings,
            &token,
        )?;
        driver.perform(
            &Action::Text {
                target: Some(Slot::A),
                text: "RUST 42".into(),
            },
            &bindings,
            &token,
        )?;
        std::thread::sleep(Duration::from_millis(30));
        let mut text = [0u16; 100];
        let length = unsafe { GetWindowTextW(id, text.as_mut_ptr(), 100) };
        assert_eq!(
            String::from_utf16_lossy(&text[..length as usize]),
            "RUST 42"
        );
        let image = capture(&window, region, &token)?;
        assert!(driver.recognize(&image, &token)?.contains("42"));
        println!("PASS: own fixture window capture, Windows OCR, Ctrl+A, Unicode typing and OCR after input.");
        Ok(())
    })();
    unsafe {
        PostMessageW(id, WM_APP + 90, 0, 0);
    }
    ui.join().unwrap();
    result.unwrap();
}
