use std::sync::Arc;

use tauri::{AppHandle, State};

use crate::parser::discover::{discover_sessions, CodexSessionInfo};
use crate::state::AppState;
use crate::watcher::start_picker_watcher;

#[tauri::command]
pub async fn list_sessions(
    sessions_dir: String,
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<CodexSessionInfo>, String> {
    let dir = std::path::Path::new(&sessions_dir);
    let mut sessions = discover_sessions(dir)?;
    state.apply_watched_ongoing(&mut sessions);
    Ok(sessions)
}

#[tauri::command]
pub async fn watch_picker(
    sessions_dir: String,
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
) -> Result<(), String> {
    state.stop_picker_watcher()?;
    let handle = start_picker_watcher(sessions_dir, state.inner().clone(), Some(app));
    state.set_picker_watcher(handle)
}

#[tauri::command]
pub async fn unwatch_picker(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    state.stop_picker_watcher()
}
