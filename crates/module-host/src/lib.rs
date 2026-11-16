//! Host knows process/protocol/module inventory, not tool engines or Win32 tool logic.
use moligod_module_protocol::{read_frame, write_frame, Packet, Request, PROTOCOL};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    fs,
    io::Read,
    path::{Path, PathBuf},
    process::{Child, ChildStdin, Command, Stdio},
    sync::{mpsc, Arc, Mutex},
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Manifest {
    pub id: String,
    pub version: String,
    pub protocol: u32,
    pub platform: String,
    pub entry: String,
    pub sha256: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleInfo {
    pub id: String,
    pub installed: bool,
    pub version: Option<String>,
    pub source: String,
    pub process_id: Option<u32>,
    pub error: Option<String>,
}
type Callback = Arc<dyn Fn(String, Value) + Send + Sync>;
type Pending = Arc<Mutex<HashMap<u64, mpsc::Sender<Result<Value, String>>>>>;

pub struct ModuleClient {
    id: String,
    bundled: PathBuf,
    installed: PathBuf,
    data: PathBuf,
    session: Option<Session>,
    callback: Callback,
}
impl ModuleClient {
    pub fn new(
        id: &str,
        bundled: PathBuf,
        installed: PathBuf,
        data: PathBuf,
        callback: impl Fn(String, Value) + Send + Sync + 'static,
    ) -> Self {
        Self {
            id: id.into(),
            bundled,
            installed,
            data,
            session: None,
            callback: Arc::new(callback),
        }
    }
    fn location(&self) -> (&Path, &str) {
        if self.installed.join("manifest.json").exists() {
            (&self.installed, "local")
        } else {
            (&self.bundled, "bundled")
        }
    }
    pub fn info(&mut self) -> ModuleInfo {
        self.reap();
        let (directory, source) = self.location();
        match resolve(directory, &self.id) {
            Ok((manifest, _)) => ModuleInfo {
                id: self.id.clone(),
                installed: true,
                version: Some(manifest.version),
                source: source.into(),
                process_id: self.session.as_ref().map(|s| s.child.id()),
                error: None,
            },
            Err(error) => ModuleInfo {
                id: self.id.clone(),
                installed: false,
                version: None,
                source: source.into(),
                process_id: None,
                error: Some(error),
            },
        }
    }
    fn reap(&mut self) {
        if self
            .session
            .as_mut()
            .is_some_and(|s| s.child.try_wait().ok().flatten().is_some())
        {
            self.session.take();
        }
    }
    pub fn is_started(&mut self) -> bool {
        self.reap();
        self.session.is_some()
    }
    /// Transfer the caller's foreground permission only to its live child.
    /// This is best-effort: Windows can refuse if the caller is not foreground.
    pub fn allow_foreground(&mut self) -> bool {
        self.reap();
        #[cfg(windows)]
        if let Some(session) = &self.session {
            return unsafe {
                windows_sys::Win32::UI::WindowsAndMessaging::AllowSetForegroundWindow(
                    session.child.id(),
                ) != 0
            };
        }
        false
    }
    pub fn call(&mut self, method: &str, payload: Value) -> Result<Value, String> {
        self.reap();
        if self.session.is_none() {
            let (directory, _) = self.location();
            let (manifest, exe) = resolve(directory, &self.id)?;
            self.session = Some(Session::start(
                &manifest,
                &exe,
                &self.data,
                self.callback.clone(),
            )?);
        }
        let result = self.session.as_mut().ok_or("模块未启动")?.call(
            method,
            payload,
            // Native RTX initialization and first-use kernel compilation are
            // bounded separately by the OCR worker. Other IPC stays at 30s.
            Duration::from_secs(if self.id == "automation" && method == "ocr-test" {
                370
            } else {
                30
            }),
        );
        if matches!(result,Err(ref e) if e.starts_with("IPC:")) {
            self.session.take();
        }
        result
    }
    pub fn shutdown(&mut self) {
        if let Some(mut session) = self.session.take() {
            let _ = session.call("shutdown", Value::Null, Duration::from_secs(3));
        }
    }
}
impl Drop for ModuleClient {
    fn drop(&mut self) {
        self.shutdown();
    }
}

fn resolve(directory: &Path, id: &str) -> Result<(Manifest, PathBuf), String> {
    let file = fs::File::open(directory.join("manifest.json"))
        .map_err(|_| format!("{id} 模块未安装，请使用包含该模块的安装包"))?;
    let mut data = Vec::new();
    file.take(65537)
        .read_to_end(&mut data)
        .map_err(|e| e.to_string())?;
    if data.len() > 65536 {
        return Err("模块清单过大".into());
    }
    let manifest: Manifest =
        serde_json::from_slice(&data).map_err(|e| format!("模块清单损坏：{e}"))?;
    if manifest.id != id
        || manifest.protocol != PROTOCOL
        || manifest.platform != "windows-x86_64"
        || manifest.version.is_empty()
        || manifest.version.len() > 64
    {
        return Err("模块身份、版本或协议不兼容".into());
    }
    if manifest.entry.is_empty()
        || !manifest.entry.ends_with(".exe")
        || !manifest
            .entry
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || b"-_.".contains(&c))
        || manifest.entry.contains("..")
    {
        return Err("模块程序路径无效".into());
    }
    let root = directory.canonicalize().map_err(|e| e.to_string())?;
    let executable = directory
        .join(&manifest.entry)
        .canonicalize()
        .map_err(|_| "模块程序缺失")?;
    if !executable.starts_with(&root) {
        return Err("模块程序超出安装目录".into());
    }
    let mut file = fs::File::open(&executable).map_err(|e| e.to_string())?;
    let mut hash = Sha256::new();
    let mut buffer = [0u8; 65536];
    loop {
        let n = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        hash.update(&buffer[..n]);
    }
    if format!("{:x}", hash.finalize()) != manifest.sha256 {
        return Err("模块文件校验失败，请重新安装模块".into());
    }
    Ok((manifest, executable))
}

struct Session {
    child: Child,
    input: ChildStdin,
    pending: Pending,
    reader: Option<JoinHandle<()>>,
    next_id: u64,
    _job: Job,
}
impl Session {
    fn start(
        manifest: &Manifest,
        exe: &Path,
        data: &Path,
        callback: Callback,
    ) -> Result<Self, String> {
        use std::os::windows::process::CommandExt;
        let mut command = Command::new(exe);
        command
            .arg("--data-dir")
            .arg(data)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .creation_flags(0x08000000);
        let mut child = command.spawn().map_err(|e| format!("启动模块失败：{e}"))?;
        let job = match Job::attach(&child) {
            Ok(job) => job,
            Err(e) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(e);
            }
        };
        let input = child.stdin.take().ok_or("模块输入通道缺失")?;
        let mut output = child.stdout.take().ok_or("模块输出通道缺失")?;
        let pending: Pending = Arc::default();
        let responses = pending.clone();
        let (ready, startup) = mpsc::channel();
        let id = manifest.id.clone();
        let version = manifest.version.clone();
        let reader = thread::Builder::new()
            .name(format!("module-{id}-ipc"))
            .spawn(move || {
                let hello = read_frame::<Packet>(&mut output);
                let result: Result<(), String> = match hello {
                    Ok(Some(Packet::Hello {
                        protocol,
                        module,
                        version: v,
                    })) if protocol == PROTOCOL && module == id && v == version => Ok(()),
                    _ => Err("IPC: 模块握手不匹配".into()),
                };
                let valid = result.is_ok();
                let _ = ready.send(result);
                if !valid {
                    return;
                }
                while let Ok(Some(packet)) = read_frame::<Packet>(&mut output) {
                    match packet {
                        Packet::Reply { id, result } => {
                            if let Ok(mut map) = responses.lock() {
                                if let Some(send) = map.remove(&id) {
                                    let _ = send.send(result);
                                }
                            }
                        }
                        Packet::Event { name, data } => callback(name, data),
                        Packet::Hello { .. } => break,
                    }
                }
                if let Ok(mut map) = responses.lock() {
                    for (_, send) in map.drain() {
                        let _ = send.send(Err("IPC: 模块进程已退出".into()));
                    }
                }
                callback("module-disconnected".into(), json!({"module":id}));
            })
            .map_err(|e| {
                let _ = child.kill();
                let _ = child.wait();
                e.to_string()
            })?;
        let session = Self {
            child,
            input,
            pending,
            reader: Some(reader),
            next_id: 0,
            _job: job,
        };
        startup
            .recv_timeout(Duration::from_secs(10))
            .map_err(|_| "IPC: 模块启动超时")??;
        Ok(session)
    }
    fn call(&mut self, method: &str, payload: Value, timeout: Duration) -> Result<Value, String> {
        self.next_id += 1;
        let id = self.next_id;
        let (send, receive) = mpsc::channel();
        self.pending
            .lock()
            .map_err(|_| "IPC: 响应锁异常")?
            .insert(id, send);
        if let Err(error) = write_frame(
            &mut self.input,
            &Request {
                protocol: PROTOCOL,
                id,
                method: method.into(),
                payload,
            },
        ) {
            self.pending
                .lock()
                .map_err(|_| "IPC: 响应锁异常")?
                .remove(&id);
            return Err(format!("IPC: {error}"));
        }
        match receive.recv_timeout(timeout) {
            Ok(result) => result,
            Err(_) => {
                if let Ok(mut map) = self.pending.lock() {
                    map.remove(&id);
                }
                Err("IPC: 模块响应超时".into())
            }
        }
    }
}
impl Drop for Session {
    fn drop(&mut self) {
        let deadline = Instant::now() + Duration::from_millis(500);
        while self.child.try_wait().ok().flatten().is_none() && Instant::now() < deadline {
            thread::sleep(Duration::from_millis(10));
        }
        let _ = self.child.kill();
        let _ = self.child.wait();
        if let Some(reader) = self.reader.take() {
            let _ = reader.join();
        }
    }
}
struct Job(usize);
impl Job {
    fn attach(child: &Child) -> Result<Self, String> {
        use std::os::windows::io::AsRawHandle;
        use windows_sys::Win32::System::JobObjects::*;
        unsafe {
            let handle = CreateJobObjectW(std::ptr::null(), std::ptr::null());
            if handle.is_null() {
                return Err(std::io::Error::last_os_error().to_string());
            }
            let job = Self(handle as usize);
            let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            if SetInformationJobObject(
                handle,
                JobObjectExtendedLimitInformation,
                (&info as *const JOBOBJECT_EXTENDED_LIMIT_INFORMATION).cast(),
                std::mem::size_of_val(&info) as u32,
            ) == 0
                || AssignProcessToJobObject(handle, child.as_raw_handle()) == 0
            {
                return Err(std::io::Error::last_os_error().to_string());
            }
            Ok(job)
        }
    }
}
impl Drop for Job {
    fn drop(&mut self) {
        unsafe {
            windows_sys::Win32::Foundation::CloseHandle(self.0 as _);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn refuses_missing_tampered_and_path_escape_modules() {
        let dir = tempfile::tempdir().unwrap();
        assert!(resolve(dir.path(), "crosshair").is_err());
        let exe = b"not a binary";
        fs::write(dir.path().join("engine.exe"), exe).unwrap();
        let mut manifest = Manifest {
            id: "crosshair".into(),
            version: env!("CARGO_PKG_VERSION").into(),
            protocol: 1,
            platform: "windows-x86_64".into(),
            entry: "engine.exe".into(),
            sha256: format!("{:x}", Sha256::digest(exe)),
        };
        fs::write(
            dir.path().join("manifest.json"),
            serde_json::to_vec(&manifest).unwrap(),
        )
        .unwrap();
        assert!(resolve(dir.path(), "crosshair").is_ok());
        fs::write(dir.path().join("engine.exe"), b"modified").unwrap();
        assert!(resolve(dir.path(), "crosshair").is_err());
        manifest.entry = "../other.exe".into();
        fs::write(
            dir.path().join("manifest.json"),
            serde_json::to_vec(&manifest).unwrap(),
        )
        .unwrap();
        assert!(resolve(dir.path(), "crosshair").is_err());
    }
}
