use std::sync::Arc;
use std::time::Duration;

use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;

use crate::parser::discover::CodexSessionInfo;
use crate::parser::session::parse_session;
use crate::state::AppState;

const WATCHER_DEBOUNCE: Duration = Duration::from_millis(300);

fn run_debounce_loop(
    rx: std::sync::mpsc::Receiver<Result<notify::Event, notify::Error>>,
    filter: impl Fn(&notify::Event) -> bool,
    signal_tx: mpsc::Sender<()>,
    thread_stop_rx: std::sync::mpsc::Receiver<()>,
) {
    let mut debounce_timer: Option<std::time::Instant> = None;

    loop {
        match thread_stop_rx.try_recv() {
            Ok(()) | Err(std::sync::mpsc::TryRecvError::Disconnected) => break,
            Err(std::sync::mpsc::TryRecvError::Empty) => {}
        }

        match rx.recv_timeout(Duration::from_millis(100)) {
            Ok(Ok(event)) => {
                if filter(&event) {
                    debounce_timer = Some(std::time::Instant::now());
                }
            }
            Ok(Err(_)) | Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {}
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
        }

        if let Some(timer) = debounce_timer {
            if timer.elapsed() >= WATCHER_DEBOUNCE {
                debounce_timer = None;
                let _ = signal_tx.try_send(());
            }
        }
    }
}

pub struct WatcherHandle {
    stop_tx: mpsc::Sender<()>,
    thread_stop_tx: std::sync::mpsc::SyncSender<()>,
}

impl WatcherHandle {
    pub fn stop(&self) {
        let _ = self.stop_tx.try_send(());
        let _ = self.thread_stop_tx.try_send(());
    }
}

#[derive(Clone, serde::Serialize)]
struct SessionUpdatePayload {
    session: crate::parser::session::CodexSession,
}

fn is_related_session_path(changed_path: &Path, session_file: &Path) -> bool {
    if changed_path == session_file {
        return true;
    }

    changed_path.extension().and_then(|ext| ext.to_str()) == Some("jsonl")
        && changed_path.parent() == session_file.parent()
}

/// Start watching a session JSONL file for changes.
pub fn start_session_watcher(
    path: String,
    state: Arc<AppState>,
    app: Option<AppHandle>,
) -> WatcherHandle {
    let (stop_tx, mut stop_rx) = mpsc::channel::<()>(1);
    let (signal_tx, mut signal_rx) = mpsc::channel::<()>(4);
    let (thread_stop_tx, thread_stop_rx) = std::sync::mpsc::sync_channel::<()>(1);

    let path_clone = path.clone();
    let signal_tx_clone = signal_tx.clone();

    std::thread::spawn(move || {
        let signal_tx = signal_tx_clone;
        let path = path_clone;
        let (tx, rx) = std::sync::mpsc::channel();
        let mut watcher = match RecommendedWatcher::new(tx, Config::default()) {
            Ok(w) => w,
            Err(_) => return,
        };

        // Watch the day directory (parent of file) so we catch appends
        let watch_dir = Path::new(&path).parent().unwrap_or(Path::new(""));
        let _ = watcher.watch(watch_dir, RecursiveMode::NonRecursive);

        let session_file = PathBuf::from(path.clone());
        run_debounce_loop(
            rx,
            move |event| {
                event
                    .paths
                    .iter()
                    .any(|p| is_related_session_path(p, &session_file))
            },
            signal_tx,
            thread_stop_rx,
        );
    });

    let path_for_rebuild = path.clone();
    tokio::spawn(async move {
        let mut prev_ongoing = false;

        loop {
            tokio::select! {
                _ = stop_rx.recv() => break,
                Some(()) = signal_rx.recv() => {
                    let p = std::path::Path::new(&path_for_rebuild);
                    let session = match parse_session(p) {
                        Ok(s) => s,
                        Err(_) => continue,
                    };

                    let ongoing = session.is_ongoing;
                    state.set_watched_ongoing(path_for_rebuild.clone(), ongoing);

                    let payload = SessionUpdatePayload { session };
                    if let Ok(json) = serde_json::to_string(&payload) {
                        state.broadcast("session-update", &json);
                    }

                    if let Some(ref app_handle) = app {
                        let _ = app_handle.emit("session-update", payload);
                    }

                    prev_ongoing = ongoing;
                }
            }
        }
        let _ = prev_ongoing;
    });

    WatcherHandle {
        stop_tx,
        thread_stop_tx,
    }
}

#[derive(Clone, serde::Serialize)]
struct PickerRefreshPayload {
    sessions: Vec<CodexSessionInfo>,
}

/// Start watching the sessions directory for new/changed files.
pub fn start_picker_watcher(
    sessions_dir: String,
    state: Arc<AppState>,
    app: Option<AppHandle>,
) -> WatcherHandle {
    let (stop_tx, mut stop_rx) = mpsc::channel::<()>(1);
    let (signal_tx, mut signal_rx) = mpsc::channel::<()>(4);
    let (thread_stop_tx, thread_stop_rx) = std::sync::mpsc::sync_channel::<()>(1);

    let signal_tx_clone = signal_tx.clone();
    let sessions_dir_thread = sessions_dir.clone();

    std::thread::spawn(move || {
        let (tx, rx) = std::sync::mpsc::channel();
        let mut watcher = match RecommendedWatcher::new(tx, Config::default()) {
            Ok(w) => w,
            Err(_) => return,
        };

        let dir = std::path::Path::new(&sessions_dir_thread);
        if dir.exists() {
            let _ = watcher.watch(dir, RecursiveMode::Recursive);
        }

        run_debounce_loop(
            rx,
            |event| {
                event.paths.iter().any(|p| {
                    let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
                    name.ends_with(".jsonl")
                })
            },
            signal_tx_clone,
            thread_stop_rx,
        );
    });

    let dir_clone = sessions_dir;
    tokio::spawn(async move {
        loop {
            tokio::select! {
                _ = stop_rx.recv() => break,
                Some(()) = signal_rx.recv() => {
                    let dir = std::path::Path::new(&dir_clone);
                    let mut sessions = match crate::parser::discover::discover_sessions(dir) {
                        Ok(s) => s,
                        Err(_) => continue,
                    };

                    state.apply_watched_ongoing(&mut sessions);

                    let payload = PickerRefreshPayload { sessions };
                    if let Ok(json) = serde_json::to_string(&payload) {
                        state.broadcast("picker-refresh", &json);
                    }

                    if let Some(ref app_handle) = app {
                        let _ = app_handle.emit("picker-refresh", payload);
                    }
                }
            }
        }
    });

    WatcherHandle {
        stop_tx,
        thread_stop_tx,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::sync::mpsc;

    #[test]
    fn watcher_handle_stop_idempotent() {
        let (stop_tx, _) = mpsc::channel::<()>(1);
        let (thread_stop_tx, _) = std::sync::mpsc::sync_channel::<()>(1);
        let handle = WatcherHandle {
            stop_tx,
            thread_stop_tx,
        };
        handle.stop();
        handle.stop();
    }

    #[test]
    fn related_session_path_matches_parent_file() {
        let session_file = Path::new("/tmp/sessions/rollout-parent.jsonl");
        assert!(is_related_session_path(session_file, session_file));
    }

    #[test]
    fn related_session_path_matches_sibling_jsonl_worker_file() {
        let session_file = Path::new("/tmp/sessions/rollout-parent.jsonl");
        let worker_file = Path::new("/tmp/sessions/rollout-worker.jsonl");
        assert!(is_related_session_path(worker_file, session_file));
    }

    #[test]
    fn related_session_path_ignores_non_jsonl_siblings() {
        let session_file = Path::new("/tmp/sessions/rollout-parent.jsonl");
        let temp_file = Path::new("/tmp/sessions/rollout-worker.tmp");
        assert!(!is_related_session_path(temp_file, session_file));
    }

    #[test]
    fn related_session_path_ignores_jsonl_in_other_directory() {
        let session_file = Path::new("/tmp/sessions/rollout-parent.jsonl");
        let other_file = Path::new("/tmp/other/rollout-worker.jsonl");
        assert!(!is_related_session_path(other_file, session_file));
    }

    #[test]
    fn related_session_path_ignores_socket_and_non_jsonl_paths() {
        // Transport boundary guard: the watcher reacts only to .jsonl file
        // events, never to socket or other IPC paths. This confirms codex-trace
        // reads sessions from disk rather than connecting to any live process
        // socket (e.g. the Codex app-server Unix socket upgraded in v0.128.0).
        let session_file = Path::new("/tmp/sessions/rollout-parent.jsonl");
        assert!(!is_related_session_path(
            Path::new("/tmp/sessions/codex.sock"),
            session_file
        ));
        assert!(!is_related_session_path(
            Path::new("/tmp/sessions/codex.pid"),
            session_file
        ));
    }
}
