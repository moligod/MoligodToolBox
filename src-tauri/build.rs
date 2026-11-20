fn main() {
    println!("cargo:rustc-check-cfg=cfg(protected_install)");
    let mut attributes = tauri_build::Attributes::new();
    if !tauri_build::is_dev() {
        println!("cargo:rustc-cfg=protected_install");
        let windows = tauri_build::WindowsAttributes::new()
            .app_manifest(include_str!("windows-app-manifest.xml"));
        attributes = attributes.windows_attributes(windows);
    }
    tauri_build::try_build(attributes).expect("failed to run Tauri build script");
}
