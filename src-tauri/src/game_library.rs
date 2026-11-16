use crate::{main_window, AppState};
use moligod_core::game_library::GameLibrary;
use tauri::Manager;

#[tauri::command]
pub async fn load_game_library(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
) -> Result<GameLibrary, String> {
    main_window(&window)?;
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let store = state.game_library.lock().map_err(|_| "游戏资料库锁异常")?;
        store.load()
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn save_game_library(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    library: GameLibrary,
) -> Result<GameLibrary, String> {
    main_window(&window)?;
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let store = state.game_library.lock().map_err(|_| "游戏资料库锁异常")?;
        store.save(&library)?;
        Ok(library)
    })
    .await
    .map_err(|error| error.to_string())?
}
