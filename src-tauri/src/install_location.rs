use std::path::{Path, PathBuf};

const PRODUCT: &str = "MoligodToolBox";

fn bundled_modules(program_files: &Path, executable: &Path) -> Option<PathBuf> {
    let install = program_files.canonicalize().ok()?.join(PRODUCT);
    let executable = executable.canonicalize().ok()?;
    let modules = install.join("modules");
    (executable.parent()? == install && modules.canonicalize().ok()? == modules).then_some(modules)
}

#[cfg(protected_install)]
fn program_files() -> Option<PathBuf> {
    use windows::Win32::{
        System::Com::CoTaskMemFree,
        UI::Shell::{FOLDERID_ProgramFilesX64, SHGetKnownFolderPath, KF_FLAG_DEFAULT},
    };

    // Use the system's fixed known folder, independent of the launching process's environment.
    unsafe {
        let path = SHGetKnownFolderPath(&FOLDERID_ProgramFilesX64, KF_FLAG_DEFAULT, None).ok()?;
        let value = path.to_string();
        CoTaskMemFree(Some(path.0.cast()));
        Some(PathBuf::from(value.ok()?))
    }
}

#[cfg(protected_install)]
pub fn release_modules() -> Option<PathBuf> {
    bundled_modules(&program_files()?, &std::env::current_exe().ok()?)
}

#[cfg(protected_install)]
pub fn prepare_update_temp() -> Result<(), String> {
    static PREPARED: std::sync::OnceLock<Result<(), String>> = std::sync::OnceLock::new();
    PREPARED
        .get_or_init(|| {
            let program_files = program_files().ok_or("找不到 Program Files")?;
            let parent = program_files.join(PRODUCT);
            let stage = parent.join("update-cache");
            std::fs::create_dir_all(&stage).map_err(|error| error.to_string())?;
            let expected = program_files
                .canonicalize()
                .map_err(|error| error.to_string())?
                .join(PRODUCT)
                .join("update-cache");
            if stage.canonicalize().map_err(|error| error.to_string())? != expected {
                return Err("更新暂存目录不在正式安装目录中".into());
            }
            // The updater launches its verified installer from tempfile's default directory.
            tempfile::env::override_temp_dir(&stage).map_err(|_| "无法配置更新暂存目录".into())
        })
        .clone()
}

#[cfg(protected_install)]
pub fn show_install_required() {
    use windows::{
        core::w,
        Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONERROR, MB_OK},
    };
    unsafe {
        MessageBoxW(
            None,
            w!("请使用 Windows 安装包将正式版安装到 Program Files\\MoligodToolBox，再启动应用。"),
            w!("MoligodToolBox"),
            MB_OK | MB_ICONERROR,
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_the_machine_install_can_supply_release_modules() {
        let root = tempfile::tempdir().unwrap();
        let program_files = root.path().join("Program Files");
        let install = program_files.join("MoligodToolBox");
        let local = root.path().join("LocalAppData").join("MoligodToolBox");
        for directory in [&install, &local] {
            std::fs::create_dir_all(directory.join("modules")).unwrap();
            std::fs::write(directory.join("moligod.exe"), []).unwrap();
        }
        let machine_modules = std::fs::canonicalize(install.join("modules")).unwrap();
        assert_eq!(
            bundled_modules(&program_files, &install.join("moligod.exe")),
            Some(machine_modules)
        );
        assert_eq!(
            bundled_modules(&program_files, &local.join("moligod.exe")),
            None
        );
    }
}
