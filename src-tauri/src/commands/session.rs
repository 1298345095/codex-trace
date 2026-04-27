use tauri::{AppHandle, State};

use crate::parser::session::parse_session;
use crate::state::AppState;
use crate::watcher::start_session_watcher;

pub const NO_SESSION_PATH_PROVIDED: &str = "no session path provided";

pub fn load_session_from_path(path: &str) -> Result<crate::parser::session::CodexSession, String> {
    if path.is_empty() {
        return Err(NO_SESSION_PATH_PROVIDED.to_string());
    }
    let p = std::path::Path::new(path);
    parse_session(p)
}

#[tauri::command]
pub async fn load_session(path: String) -> Result<crate::parser::session::CodexSession, String> {
    load_session_from_path(&path)
}

#[tauri::command]
pub async fn watch_session(
    path: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let session = load_session_from_path(&path)?;
    state.stop_session_watcher()?;
    state.set_watched_ongoing(path.clone(), session.is_ongoing);
    let handle = start_session_watcher(path, app);
    state.set_session_watcher(handle)
}

#[tauri::command]
pub async fn unwatch_session(state: State<'_, AppState>) -> Result<(), String> {
    state.clear_watched_ongoing();
    state.stop_session_watcher()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn load_session_from_path_rejects_empty_path() {
        let result = load_session_from_path("");

        assert_eq!(result.unwrap_err(), "no session path provided");
    }
}
