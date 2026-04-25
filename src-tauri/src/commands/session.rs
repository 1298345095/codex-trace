use tauri::{AppHandle, State};

use crate::parser::session::parse_session;
use crate::state::AppState;
use crate::watcher::start_session_watcher;

#[tauri::command]
pub async fn load_session(
    path: String,
    state: State<'_, AppState>,
) -> Result<crate::parser::session::CodexSession, String> {
    if path.is_empty() {
        return Err("no session path provided".to_string());
    }
    let p = std::path::Path::new(&path);
    let session = parse_session(p)?;
    state.set_watched_ongoing(path, session.is_ongoing);
    Ok(session)
}

#[tauri::command]
pub async fn watch_session(
    path: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.stop_session_watcher()?;
    let handle = start_session_watcher(path, app);
    state.set_session_watcher(handle)
}

#[tauri::command]
pub async fn unwatch_session(state: State<'_, AppState>) -> Result<(), String> {
    state.clear_watched_ongoing();
    state.stop_session_watcher()
}
