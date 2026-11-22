use base64::{engine::general_purpose::STANDARD, Engine};
use reqwest::{header, Client, StatusCode, Url};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    fs::{self, File, OpenOptions},
    io::{Read, Seek, SeekFrom, Write},
    path::Path,
};

type Result<T> = std::result::Result<T, Box<dyn std::error::Error + Send + Sync>>;
const MAX_SIZE: u64 = 512 * 1024 * 1024;
const MAX_BLOCK: usize = 262144;

#[derive(Deserialize)]
pub(super) struct BlockMap {
    schema: u8,
    size: u64,
    blocks: Vec<(usize, String)>,
}

impl BlockMap {
    pub(super) fn parse(bytes: &[u8]) -> Result<Self> {
        let map: Self = serde_json::from_slice(bytes)?;
        if map.schema != 1
            || !(1..=MAX_SIZE).contains(&map.size)
            || map.blocks.len() > 32768
            || map.blocks.iter().any(|(n, h)| {
                !(1..=MAX_BLOCK).contains(n)
                    || h.len() != 64
                    || !h.bytes().all(|c| c.is_ascii_hexdigit())
            })
            || map.blocks.iter().map(|(n, _)| *n as u64).sum::<u64>() != map.size
        {
            return Err("更新分块清单无效".into());
        }
        Ok(map)
    }
}

fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn base_index(file: &mut File) -> Result<HashMap<String, u64>> {
    let size = file.metadata()?.len();
    if size > MAX_SIZE {
        return Err("旧安装包超出限制".into());
    }
    let mut index = HashMap::new();
    let mut buf = vec![0; MAX_BLOCK];
    let mut offset = 0;
    while offset < size {
        let n = (size - offset).min(MAX_BLOCK as u64) as usize;
        file.seek(SeekFrom::Start(offset))?;
        file.read_exact(&mut buf[..n])?;
        let end = buf[..n]
            .get(16384..)
            .and_then(|b| b.windows(2).position(|v| v == [0x6b, 0xb3]))
            .map_or(n, |p| 16384 + p + 2);
        index.insert(digest(&buf[..end]), offset);
        offset += end as u64;
    }
    Ok(index)
}

// Keep complete validated blocks and the partial last block across process restarts.
fn valid_prefix(file: &mut File, map: &BlockMap) -> Result<u64> {
    let mut len = file.metadata()?.len();
    if len > map.size {
        file.set_len(0)?;
        len = 0;
    }
    file.rewind()?;
    let mut offset = 0;
    let mut buf = vec![0; MAX_BLOCK];
    for (n, hash) in &map.blocks {
        if offset + *n as u64 > len {
            break;
        }
        file.read_exact(&mut buf[..*n])?;
        if digest(&buf[..*n]) != *hash {
            file.set_len(offset)?;
            return Ok(offset);
        }
        offset += *n as u64;
    }
    Ok(len)
}

async fn fetch_range(
    client: &Client,
    url: &Url,
    out: &mut File,
    start: u64,
    end: u64,
    size: u64,
) -> Result<bool> {
    let mut response = client
        .get(url.clone())
        .header(header::ACCEPT_ENCODING, "identity")
        .header(header::RANGE, format!("bytes={start}-{}", end - 1))
        .send()
        .await?
        .error_for_status()?;
    let full = response.status() == StatusCode::OK;
    let (at, limit) = if full {
        (0, size)
    } else {
        let range = format!("bytes {start}-{}/{size}", end - 1);
        if response.status() != StatusCode::PARTIAL_CONTENT
            || response
                .headers()
                .get(header::CONTENT_RANGE)
                .and_then(|v| v.to_str().ok())
                != Some(&range)
        {
            return Err("服务器返回的续传范围无效".into());
        }
        (start, end)
    };
    if response.content_length().is_some_and(|n| n != limit - at) {
        return Err("更新下载长度不匹配".into());
    }
    if full {
        out.set_len(0)?;
    }
    out.seek(SeekFrom::Start(at))?;
    let mut pos = at;
    while let Some(chunk) = response.chunk().await? {
        if chunk.len() as u64 > limit - pos {
            return Err("服务器返回超出范围的数据".into());
        }
        out.write_all(&chunk)?;
        pos += chunk.len() as u64;
    }
    if pos != limit {
        return Err("下载中断，可重新检查后续传".into());
    }
    Ok(full)
}

pub(super) fn verify(bytes: &[u8], sig: &str, version: &str, pubkey: &str) -> Result<()> {
    use minisign_verify::{PublicKey, Signature};
    let key = PublicKey::decode(std::str::from_utf8(&STANDARD.decode(pubkey)?)?)?;
    let signature = Signature::decode(std::str::from_utf8(&STANDARD.decode(sig)?)?)?;
    key.verify(bytes, &signature, true)?;
    if signature
        .trusted_comment()
        .split('\t')
        .find_map(|s| s.strip_prefix("version:"))
        != Some(version)
    {
        return Err("更新签名版本不匹配".into());
    }
    Ok(())
}

pub(super) async fn download(
    client: &Client,
    url: &Url,
    cache: &Path,
    map: Option<BlockMap>,
    sig: &str,
    version: &str,
    pubkey: &str,
) -> Result<Vec<u8>> {
    fs::create_dir_all(cache)?;
    let path = cache.join("download.part");
    let marker = cache.join("download.id");
    let id = digest(sig.as_bytes());
    let mut out = OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(&path)?;
    if fs::read(&marker).ok().as_deref() != Some(id.as_bytes()) {
        out.set_len(0)?;
        fs::write(marker, id)?;
    }
    let bytes = assemble(client, url, cache, map, &mut out).await?;
    if let Err(error) = verify(&bytes, sig, version, pubkey) {
        out.set_len(0)?;
        return Err(error);
    }
    Ok(bytes)
}

async fn assemble(
    client: &Client,
    url: &Url,
    cache: &Path,
    map: Option<BlockMap>,
    out: &mut File,
) -> Result<Vec<u8>> {
    let size = if let Some(map) = &map {
        map.size
    } else {
        client
            .head(url.clone())
            .header(header::ACCEPT_ENCODING, "identity")
            .send()
            .await?
            .error_for_status()?
            .headers()
            .get(header::CONTENT_LENGTH)
            .and_then(|v| v.to_str().ok()?.parse::<u64>().ok())
            .filter(|n| (1..=MAX_SIZE).contains(n))
            .ok_or("无法确定安装包大小")?
    };
    if let Some(map) = map {
        let mut pos = valid_prefix(out, &map)?;
        let base = cache.join("installed-base.exe");
        let (mut base, index) = tauri::async_runtime::spawn_blocking(move || {
            let mut file = File::open(base).ok();
            let index = file
                .as_mut()
                .and_then(|f| base_index(f).ok())
                .unwrap_or_default();
            (file, index)
        })
        .await?;
        let mut end = 0;
        let mut buf = vec![0; MAX_BLOCK];
        for (n, h) in map.blocks {
            let start = end;
            end += n as u64;
            if end <= pos {
                continue;
            }
            if let (Some(file), Some(offset)) = (base.as_mut(), index.get(&h)) {
                if pos < start && fetch_range(client, url, out, pos, start, size).await? {
                    pos = size;
                    break;
                }
                file.seek(SeekFrom::Start(*offset))?;
                file.read_exact(&mut buf[..n])?;
                out.seek(SeekFrom::Start(start))?;
                out.write_all(&buf[..n])?;
                pos = end;
            }
        }
        if pos < size {
            fetch_range(client, url, out, pos, size, size).await?;
        }
    } else {
        let mut pos = out.metadata()?.len();
        if pos > size {
            out.set_len(0)?;
            pos = 0;
        }
        if pos < size {
            fetch_range(client, url, out, pos, size, size).await?;
        }
    }
    out.rewind()?;
    let mut bytes = Vec::with_capacity(size as usize);
    out.read_to_end(&mut bytes)?;
    Ok(bytes)
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::net::TcpListener;

    fn map(data: &[u8]) -> BlockMap {
        // The packager makes the same cuts on the marker after the minimum block size.
        let blocks = data.chunks(18_000).map(|b| (b.len(), digest(b))).collect();
        BlockMap {
            schema: 1,
            size: data.len() as u64,
            blocks,
        }
    }

    #[test]
    fn resumes_inside_changed_block_and_reuses_base_even_after_offset_shift() {
        let dir = tempfile::tempdir().unwrap();
        let mut old = vec![1; 18_000];
        old[17_998..].copy_from_slice(&[0x6b, 0xb3]);
        let mut changed = vec![2; 18_000];
        changed[17_998..].copy_from_slice(&[0x6b, 0xb3]);
        let tail = vec![3; 18_000];
        let target = [old.clone(), changed.clone(), tail.clone()].concat();
        let base = [old, tail].concat();
        fs::write(dir.path().join("installed-base.exe"), base).unwrap();
        let mut out = tempfile::tempfile().unwrap();
        out.write_all(&target[..19_000]).unwrap();
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let url = Url::parse(&format!(
            "http://{}/installer",
            listener.local_addr().unwrap()
        ))
        .unwrap();
        let server = std::thread::spawn(move || {
            use std::io::{BufRead, BufReader};
            let (mut socket, _) = listener.accept().unwrap();
            let mut headers = String::new();
            let mut line = String::new();
            let mut reader = BufReader::new(&socket);
            loop {
                line.clear();
                if reader.read_line(&mut line).unwrap() == 0 || line == "\r\n" {
                    break;
                }
                headers.push_str(&line);
            }
            assert!(headers.to_lowercase().contains("range: bytes=19000-35999"));
            write!(socket,"HTTP/1.1 206 Partial Content\r\nContent-Range: bytes 19000-35999/54000\r\nContent-Length: 17000\r\nConnection: close\r\n\r\n").unwrap();
            socket.write_all(&changed[1000..]).unwrap();
        });
        let client = Client::builder()
            .no_proxy()
            .timeout(std::time::Duration::from_secs(5))
            .build()
            .unwrap();
        let bytes = tauri::async_runtime::block_on(assemble(
            &client,
            &url,
            dir.path(),
            Some(map(&target)),
            &mut out,
        ))
        .unwrap();
        server.join().unwrap();
        assert_eq!(bytes, target);
    }

    #[test]
    fn corrupt_completed_block_rewinds_only_to_last_good_offset() {
        let data = vec![7; 36_000];
        let mut damaged = data.clone();
        damaged[19_000] = 1;
        let mut file = tempfile::tempfile().unwrap();
        file.write_all(&damaged).unwrap();
        assert_eq!(valid_prefix(&mut file, &map(&data)).unwrap(), 18_000);
        assert_eq!(file.metadata().unwrap().len(), 18_000);
        assert!(BlockMap::parse(br#"{"schema":1,"size":1,"blocks":[]}"#).is_err());
    }

    #[test]
    #[ignore = "requires a local signed release and a matching live HTTP download URL"]
    fn resumes_a_real_signed_release() {
        let root = std::path::PathBuf::from(std::env::var("MOLIGOD_TEST_RELEASE_DIR").unwrap());
        let url = Url::parse(&std::env::var("MOLIGOD_TEST_INSTALLER_URL").unwrap()).unwrap();
        let manifest: serde_json::Value =
            serde_json::from_slice(&fs::read(root.join("latest.json")).unwrap()).unwrap();
        let map =
            BlockMap::parse(&fs::read(root.join("windows-x64.blocks.json")).unwrap()).unwrap();
        let version = manifest["version"].as_str().unwrap();
        let sig = manifest["platforms"]["windows-x86_64"]["signature"]
            .as_str()
            .unwrap();
        let config: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        let key = config["plugins"]["updater"]["pubkey"].as_str().unwrap();
        let original =
            fs::read(root.join(format!("MoligodToolBox_{version}_x64-setup.exe"))).unwrap();
        let cache = tempfile::tempdir().unwrap();
        fs::write(cache.path().join("download.id"), digest(sig.as_bytes())).unwrap();
        fs::write(
            cache.path().join("download.part"),
            &original[..original.len() - 8192],
        )
        .unwrap();
        let client = Client::builder()
            .no_proxy()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .unwrap();
        let bytes = tauri::async_runtime::block_on(download(
            &client,
            &url,
            cache.path(),
            Some(map),
            sig,
            version,
            key,
        ))
        .unwrap();
        assert_eq!(digest(&bytes), digest(&original));
        assert!(verify(&bytes, sig, "0.0.0", key).is_err());
        assert!(verify(&bytes[1..], sig, version, key).is_err());
    }
}
