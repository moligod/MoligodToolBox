//! Same-directory temp-file replacement for the small automation settings files.
use std::io::{Read, Write};
use std::path::Path;

/// Write `bytes` to `path` through a synced temporary file in the same directory, so a
/// crash or full disk leaves either the old file or the new one, never a partial copy.
pub(crate) fn write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let mut temp = tempfile::NamedTempFile::new_in(path.parent().ok_or("目录无效")?)
        .map_err(|e| e.to_string())?;
    temp.write_all(bytes).map_err(|e| e.to_string())?;
    temp.as_file().sync_all().map_err(|e| e.to_string())?;
    temp.persist(path).map_err(|e| e.to_string())?;
    Ok(())
}

/// Replace `directory/file_name`, first refreshing `file_name.bak` from the current file
/// the same atomic way. Callers have already validated the current file; `limit` only
/// bounds the re-read.
pub(crate) fn replace_with_backup(
    directory: &Path,
    file_name: &str,
    bytes: &[u8],
    limit: u64,
) -> Result<(), String> {
    std::fs::create_dir_all(directory).map_err(|e| e.to_string())?;
    let target = directory.join(file_name);
    match std::fs::File::open(&target) {
        Ok(file) => {
            let mut previous = Vec::new();
            file.take(limit + 1)
                .read_to_end(&mut previous)
                .map_err(|e| e.to_string())?;
            if previous.len() as u64 > limit {
                return Err("原文件超过限制，已保留原文件".into());
            }
            write(&directory.join(format!("{file_name}.bak")), &previous)?;
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => return Err(e.to_string()),
    }
    write(&target, bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn backup_and_target_are_replaced_without_leftover_temp_files() {
        let dir = tempfile::tempdir().unwrap();
        replace_with_backup(dir.path(), "a.json", b"one", 16).unwrap();
        assert!(!dir.path().join("a.json.bak").exists());
        replace_with_backup(dir.path(), "a.json", b"two", 16).unwrap();
        replace_with_backup(dir.path(), "a.json", b"three", 16).unwrap();
        assert_eq!(std::fs::read(dir.path().join("a.json")).unwrap(), b"three");
        assert_eq!(
            std::fs::read(dir.path().join("a.json.bak")).unwrap(),
            b"two"
        );
        let mut names: Vec<_> = std::fs::read_dir(dir.path())
            .unwrap()
            .map(|entry| entry.unwrap().file_name().into_string().unwrap())
            .collect();
        names.sort();
        assert_eq!(names, ["a.json", "a.json.bak"]);
        // An oversized current file is never copied over the existing backup.
        std::fs::write(dir.path().join("a.json"), [b'x'; 17]).unwrap();
        assert!(replace_with_backup(dir.path(), "a.json", b"four", 16).is_err());
        assert_eq!(
            std::fs::read(dir.path().join("a.json.bak")).unwrap(),
            b"two"
        );
        assert_eq!(
            std::fs::read(dir.path().join("a.json")).unwrap(),
            [b'x'; 17]
        );
    }
}
