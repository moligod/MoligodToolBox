use tauri::WebviewWindow;

#[tauri::command]
pub async fn choose_capture_directory(window: WebviewWindow) -> Result<Option<String>, String> {
    super::tool_windows::tool(&window, "automation")?;
    #[cfg(windows)]
    {
        let owner = window.hwnd().map_err(|e| e.to_string())?.0 as isize;
        tauri::async_runtime::spawn_blocking(move || {
            std::thread::spawn(move || pick(owner))
                .join()
                .map_err(|_| "选择文件夹失败".to_string())?
        })
        .await
        .map_err(|e| e.to_string())?
    }
    #[cfg(not(windows))]
    Err("仅Windows支持选择保存文件夹".into())
}

#[cfg(windows)]
fn pick(owner: isize) -> Result<Option<String>, String> {
    use windows::{
        core::w,
        Win32::{
            Foundation::HWND,
            System::Com::{
                CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize,
                CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED,
            },
            UI::Shell::{
                FileOpenDialog, IFileOpenDialog, FOS_FORCEFILESYSTEM, FOS_PATHMUSTEXIST,
                FOS_PICKFOLDERS, SIGDN_FILESYSPATH,
            },
        },
    };
    struct Apartment;
    impl Drop for Apartment {
        fn drop(&mut self) {
            unsafe {
                CoUninitialize();
            }
        }
    }
    unsafe {
        CoInitializeEx(None, COINIT_APARTMENTTHREADED)
            .ok()
            .map_err(|e| e.to_string())?;
        let _apartment = Apartment;
        let dialog: IFileOpenDialog = CoCreateInstance(&FileOpenDialog, None, CLSCTX_INPROC_SERVER)
            .map_err(|e| e.to_string())?;
        dialog
            .SetOptions(FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM | FOS_PATHMUSTEXIST)
            .map_err(|e| e.to_string())?;
        dialog
            .SetTitle(w!("修改截图保存位置"))
            .map_err(|e| e.to_string())?;
        if let Err(error) = dialog.Show(Some(HWND(owner as *mut _))) {
            if error.code().0 == 0x800704C7u32 as i32 {
                return Ok(None);
            }
            return Err(error.to_string());
        }
        let item = dialog.GetResult().map_err(|e| e.to_string())?;
        let path = item
            .GetDisplayName(SIGDN_FILESYSPATH)
            .map_err(|e| e.to_string())?;
        let result = path.to_string().map_err(|e| e.to_string());
        CoTaskMemFree(Some(path.0.cast()));
        let path = result?;
        // The automation engine refuses non-drive paths; say so at selection time.
        if !drive_path(&path) {
            return Err("截图不能保存到网络位置，请选择本机磁盘文件夹或已映射的驱动器".into());
        }
        Ok(Some(path))
    }
}

#[cfg(windows)]
fn drive_path(path: &str) -> bool {
    use std::path::{Component, Prefix};
    matches!(
        std::path::Path::new(path).components().next(),
        Some(Component::Prefix(prefix))
            if matches!(prefix.kind(), Prefix::Disk(_) | Prefix::VerbatimDisk(_))
    )
}
