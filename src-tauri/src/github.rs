use reqwest::{Client, Url};
use semver::Version;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::Manager;
use tauri_plugin_updater::UpdaterExt;

#[path = "update_download.rs"]
mod update_download;

const MIRROR: &str = "https://dl.trovebbs.com/moligod-toolbox";
const REPOSITORY: &str = "moligod/MoligodToolBox";
const RAW_ROOT: &str =
    "https://raw.githubusercontent.com/moligod/MoligodToolBox/main/official-components";
const MAX_JSON_BYTES: usize = 1024 * 1024;
const ACCESS_ERROR: &str = "无法访问官方 GitHub 仓库，请检查网络连接后重试";

#[derive(Default)]
pub(crate) struct State {
    installing: AtomicBool,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Catalog {
    schema_version: u32,
    components: Vec<Component>,
}

#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct Component {
    id: String,
    name: String,
    description: String,
}

#[derive(Deserialize)]
struct GitHubRelease {
    tag_name: String,
    body: Option<String>,
    draft: bool,
    prerelease: bool,
    #[serde(default)]
    assets: Vec<ReleaseAsset>,
}

#[derive(Deserialize)]
struct ReleaseAsset {
    name: String,
}

#[derive(Serialize)]
pub(crate) struct Release {
    version: String,
    tag: String,
    notes: String,
    #[serde(skip)]
    mirror: bool,
}

fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
}

fn parse_catalog(bytes: &[u8]) -> Result<Catalog, String> {
    let catalog: Catalog = serde_json::from_slice(bytes).map_err(|_| "官方组件目录格式无效")?;
    if catalog.schema_version != 1 || catalog.components.len() > 100 {
        return Err("官方组件目录版本不支持或数量超过限制".into());
    }
    let mut ids = std::collections::HashSet::new();
    for component in &catalog.components {
        if !valid_id(&component.id)
            || !ids.insert(&component.id)
            || component.name.trim().is_empty()
            || component.name.chars().count() > 80
            || component.description.chars().count() > 1000
        {
            return Err("官方组件目录包含无效条目".into());
        }
    }
    Ok(catalog)
}

fn newer_release(bytes: &[u8], current: &str) -> Result<Option<Release>, String> {
    let release: GitHubRelease =
        serde_json::from_slice(bytes).map_err(|_| "官方版本信息格式无效")?;
    if release.draft
        || release.prerelease
        || !release
            .assets
            .iter()
            .any(|asset| asset.name == "latest.json")
    {
        return Ok(None);
    }
    let version = Version::parse(
        release
            .tag_name
            .strip_prefix('v')
            .unwrap_or(&release.tag_name),
    )
    .map_err(|_| "官方版本号格式无效")?;
    let current = Version::parse(current).map_err(|_| "本机版本号格式无效")?;
    if !version.pre.is_empty() || !version.cmp_precedence(&current).is_gt() {
        return Ok(None);
    }
    Ok(Some(Release {
        mirror: false,
        version: version.to_string(),
        tag: release.tag_name,
        notes: release
            .body
            .unwrap_or_default()
            .chars()
            .take(10000)
            .collect(),
    }))
}

async fn read_github(url: &str) -> Result<Vec<u8>, String> {
    let client = Client::builder()
        .user_agent(concat!("MoligodToolBox/", env!("CARGO_PKG_VERSION")))
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(15))
        .redirect(reqwest::redirect::Policy::limited(3))
        .build()
        .map_err(|_| ACCESS_ERROR)?;
    let mut response = client.get(url).send().await.map_err(|_| ACCESS_ERROR)?;
    if !response.status().is_success() {
        return Err(format!(
            "{ACCESS_ERROR}（HTTP {}）",
            response.status().as_u16()
        ));
    }
    if response
        .content_length()
        .is_some_and(|size| size > MAX_JSON_BYTES as u64)
    {
        return Err("官方数据超过1MiB限制".into());
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| ACCESS_ERROR)? {
        if bytes.len() + chunk.len() > MAX_JSON_BYTES {
            return Err("官方数据超过1MiB限制".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}

async fn github_release() -> Result<Option<Release>, String> {
    let bytes = read_github(&format!(
        "https://api.github.com/repos/{REPOSITORY}/releases/latest"
    ))
    .await?;
    newer_release(&bytes, env!("CARGO_PKG_VERSION"))
}

fn from_mainland() -> bool {
    #[cfg(windows)]
    {
        use windows::Win32::Globalization::{GetUserGeoID, GEOCLASS_NATION};
        // Windows home region (China = 45); Hong Kong has a separate ID.
        unsafe { GetUserGeoID(GEOCLASS_NATION) == 45 }
    }
    #[cfg(not(windows))]
    {
        false
    }
}

fn mirror_release(bytes: &[u8], current: &str) -> Result<Option<Release>, String> {
    #[derive(Deserialize)]
    struct Manifest {
        version: String,
        notes: Option<String>,
    }
    let manifest: Manifest = serde_json::from_slice(bytes).map_err(|_| "国内更新清单格式无效")?;
    let v = Version::parse(&manifest.version).map_err(|_| "国内更新版本号无效")?;
    let current = Version::parse(current).map_err(|_| "本机版本号无效")?;
    if !v.pre.is_empty() || !v.build.is_empty() || !v.cmp_precedence(&current).is_gt() {
        return Ok(None);
    }
    Ok(Some(Release {
        version: v.to_string(),
        tag: format!("v{v}"),
        notes: manifest
            .notes
            .unwrap_or_default()
            .chars()
            .take(10000)
            .collect(),
        mirror: true,
    }))
}

async fn latest_release() -> Result<Option<Release>, String> {
    if from_mainland() {
        if let Ok(bytes) = read_github(&format!("{MIRROR}/latest.json")).await {
            return mirror_release(&bytes, env!("CARGO_PKG_VERSION"));
        }
    }
    github_release().await
}

#[tauri::command]
pub(crate) async fn official_component_catalog(
    window: tauri::WebviewWindow,
) -> Result<Catalog, String> {
    crate::tool_windows::tool(&window, "automation")?;
    parse_catalog(&read_github(&format!("{RAW_ROOT}/index.json")).await?)
}

#[tauri::command]
pub(crate) async fn official_component_code(
    window: tauri::WebviewWindow,
    id: String,
) -> Result<String, String> {
    crate::tool_windows::tool(&window, "automation")?;
    if !valid_id(&id) {
        return Err("官方组件标识无效".into());
    }
    String::from_utf8(read_github(&format!("{RAW_ROOT}/{id}.json")).await?)
        .map_err(|_| "官方组件编码无效".into())
}

#[tauri::command]
pub(crate) async fn check_app_update(
    window: tauri::WebviewWindow,
) -> Result<Option<Release>, String> {
    crate::main_window(&window)?;
    latest_release().await
}

#[tauri::command]
pub(crate) async fn install_app_update(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    version: String,
) -> Result<(), String> {
    crate::main_window(&window)?;
    let state = app.state::<State>();
    if state.installing.swap(true, Ordering::AcqRel) {
        return Err("正在安装更新，请稍候".into());
    }
    let result = install(&app, &version).await;
    state.installing.store(false, Ordering::Release);
    result
}

async fn install(app: &tauri::AppHandle, expected: &str) -> Result<(), String> {
    let release = latest_release().await?.ok_or("当前已是最新版本")?;
    if release.version != expected {
        return Err("官方最新版本已变化，请重新检查更新".into());
    }
    let release_root = if release.mirror {
        format!("{MIRROR}/releases/{}", release.tag)
    } else {
        format!(
            "https://github.com/{REPOSITORY}/releases/download/{}",
            release.tag
        )
    };
    let endpoint =
        Url::parse(&format!("{release_root}/latest.json")).map_err(|_| "官方更新地址无效")?;
    // The updater plugin reads its manifest without a size limit, so read the same immutable
    // release asset through the bounded reader first and require the plugin to agree with it.
    let checked: serde_json::Value = serde_json::from_slice(&read_github(endpoint.as_str()).await?)
        .map_err(|_| "官方更新清单无效")?;
    let handle = app.clone();
    let update = app
        .updater_builder()
        .endpoints(vec![endpoint])
        .map_err(|e| e.to_string())?
        .timeout(Duration::from_secs(15))
        .on_before_exit(move || crate::stop_tools(&handle))
        .build()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|_| "无法获取官方更新清单，请确认该 Release 已上传签名更新文件")?
        .ok_or("当前已是最新版本")?;
    if update.raw_json != checked {
        return Err("官方更新清单在检查期间发生变化，请重新检查更新".into());
    }
    let allowed = if release.mirror {
        update.download_url.as_str()
            == format!("{release_root}/MoligodToolBox_{expected}_x64-setup.exe")
    } else {
        valid_download(&update.download_url, &release.tag)
    };
    if update.version != expected || !allowed {
        return Err("更新清单的版本或下载地址无效".into());
    }
    let client = Client::builder()
        .user_agent(concat!("MoligodToolBox/", env!("CARGO_PKG_VERSION")))
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(600))
        .build()
        .map_err(|e| e.to_string())?;
    let map_url = format!("{release_root}/windows-x64.blocks.json");
    let map = match read_github(&map_url).await {
        Ok(b) => Some(update_download::BlockMap::parse(&b).map_err(|e| e.to_string())?),
        Err(_) => None,
    };
    #[cfg(protected_install)]
    let cache = {
        crate::install_location::prepare_update_temp()?;
        std::env::current_exe()
            .map_err(|e| e.to_string())?
            .parent()
            .ok_or("安装目录无效")?
            .join("update-cache")
    };
    #[cfg(not(protected_install))]
    let cache = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("updates");
    let pubkey = app
        .config()
        .plugins
        .0
        .get("updater")
        .and_then(|cfg| cfg.get("pubkey"))
        .and_then(|v| v.as_str())
        .ok_or("缺少更新公钥")?;
    let bytes = update_download::download(
        &client,
        &update.download_url,
        &cache,
        map,
        &update.signature,
        expected,
        pubkey,
    )
    .await
    .map_err(|e| format!("更新下载或签名校验失败：{e}"))?;
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(protected_install)]
        crate::install_location::prepare_update_temp()?;
        update
            .install(bytes)
            .map_err(|e| format!("更新安装失败：{e}"))
    })
    .await
    .map_err(|e| e.to_string())?
}

fn valid_download(url: &Url, tag: &str) -> bool {
    url.scheme() == "https"
        && url.host_str() == Some("github.com")
        && url.username().is_empty()
        && url.password().is_none()
        && url.port().is_none()
        && url
            .path()
            .starts_with(&format!("/{REPOSITORY}/releases/download/{tag}/"))
        && url.path().ends_with("-setup.exe")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn release_comparison_uses_semver_and_excludes_previews() {
        let release = |tag, draft, prerelease| {
            serde_json::to_vec(&serde_json::json!({"tag_name":tag,"body":"notes","draft":draft,"prerelease":prerelease,"assets":[{"name":"latest.json"}]})).unwrap()
        };
        assert_eq!(
            newer_release(&release("v0.10.0", false, false), "0.9.0")
                .unwrap()
                .unwrap()
                .version,
            "0.10.0"
        );
        for tag in ["v0.1.0", "v0.0.9", "v0.1.0+build.2", "v0.2.0-beta.1"] {
            assert!(newer_release(&release(tag, false, false), "0.1.0")
                .unwrap()
                .is_none());
        }
        assert!(newer_release(&release("v0.2.0", true, false), "0.1.0")
            .unwrap()
            .is_none());
        assert!(newer_release(&release("v0.2.0", false, true), "0.1.0")
            .unwrap()
            .is_none());
        assert!(newer_release(&release("../bad", false, false), "0.1.0").is_err());
    }

    #[test]
    fn mirror_uses_stable_versions_and_preserves_release_notes() {
        let bytes = br#"{"version":"2.1.0","notes":"release notes"}"#;
        let update = mirror_release(bytes, "2.0.9").unwrap().unwrap();
        assert!(update.mirror);
        assert_eq!(update.tag, "v2.1.0");
        assert_eq!(update.notes, "release notes");
        assert!(mirror_release(bytes, "2.1.0").unwrap().is_none());
        assert!(mirror_release(br#"{"version":"2.2.0-beta.1"}"#, "2.1.0")
            .unwrap()
            .is_none());
        assert!(mirror_release(br#"{"version":"../other-tool"}"#, "2.1.0").is_err());
    }

    #[test]
    fn historical_releases_without_toolkit_manifests_are_skipped_before_version_parsing() {
        let legacy = include_bytes!("../tests/fixtures/legacy-release.json");
        assert!(newer_release(legacy, "0.1.0").unwrap().is_none());
        let modern_without_manifest = br#"{"tag_name":"v2.0.0","body":"","draft":false,"prerelease":false,"assets":[{"name":"program.zip"}]}"#;
        assert!(newer_release(modern_without_manifest, "0.1.0")
            .unwrap()
            .is_none());
    }

    #[test]
    fn catalog_rejects_traversal_duplicate_ids_and_unsupported_versions() {
        let catalog = |version, ids: Vec<&str>| {
            serde_json::to_vec(&serde_json::json!({"schemaVersion":version,"components":ids.into_iter().map(|id|serde_json::json!({"id":id,"name":"组件","description":""})).collect::<Vec<_>>()})).unwrap()
        };
        assert!(parse_catalog(&catalog(1, vec!["wait-one-second"])).is_ok());
        for ids in [
            vec!["../private"],
            vec!["https://example.com"],
            vec!["same", "same"],
        ] {
            assert!(parse_catalog(&catalog(1, ids)).is_err());
        }
        assert!(parse_catalog(&catalog(2, vec![])).is_err());
    }

    #[test]
    fn update_download_is_bound_to_the_official_release() {
        assert!(valid_download(&Url::parse("https://github.com/moligod/MoligodToolBox/releases/download/v0.2.0/moligod_0.2.0_x64-setup.exe").unwrap(), "v0.2.0"));
        for url in [
            "https://example.com/moligod/MoligodToolBox/releases/download/v0.2.0/a-setup.exe",
            "https://github.com/other/repo/releases/download/v0.2.0/a-setup.exe",
            "https://github.com/moligod/MoligodToolBox/releases/download/v0.1.0/a-setup.exe",
        ] {
            assert!(!valid_download(&Url::parse(url).unwrap(), "v0.2.0"));
        }
    }
}
