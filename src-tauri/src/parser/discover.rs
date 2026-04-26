use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::Path;
use std::time::SystemTime;

use super::entry::RawEntry;

/// Lightweight session info for the picker list.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodexSessionInfo {
    pub id: String,
    pub path: String,
    pub cwd: Option<String>,
    pub git_branch: Option<String>,
    pub originator: Option<String>,
    pub model: Option<String>,
    pub cli_version: Option<String>,
    pub thread_name: Option<String>,
    pub turn_count: u32,
    pub start_time: String,
    pub end_time: Option<String>,
    pub total_tokens: Option<u64>,
    pub is_ongoing: bool,
    pub is_external_worker: bool,
    pub spawned_worker_ids: Vec<String>,
    /// "YYYY/MM/DD" derived from the file path
    pub date_group: String,
}

/// Scan a sessions directory recursively for all rollout-*.jsonl files.
/// Returns CodexSessionInfo sorted by filename descending (newest first).
pub fn discover_sessions(sessions_dir: &Path) -> Result<Vec<CodexSessionInfo>, String> {
    if !sessions_dir.exists() {
        return Ok(Vec::new());
    }

    let mut infos: Vec<CodexSessionInfo> = Vec::new();
    collect_jsonl_files(sessions_dir, &mut infos)?;

    // Sort newest first (ISO timestamp in filename is lexicographically sortable)
    infos.sort_by(|a, b| {
        let fa = Path::new(&a.path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");
        let fb = Path::new(&b.path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");
        fb.cmp(fa)
    });

    Ok(infos)
}

fn collect_jsonl_files(dir: &Path, infos: &mut Vec<CodexSessionInfo>) -> Result<(), String> {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return Ok(()),
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_jsonl_files(&path, infos)?;
        } else if path.extension().and_then(|e| e.to_str()) == Some("jsonl") {
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if name.starts_with("rollout-") {
                if let Some(info) = scan_session_file(&path) {
                    infos.push(info);
                }
            }
        }
    }

    Ok(())
}

/// Extract date group (YYYY/MM/DD) from the file path.
/// Path structure: .../sessions/YYYY/MM/DD/rollout-*.jsonl
fn date_group_from_path(path: &Path) -> String {
    path.parent()
        .and_then(|p| {
            let dd = p.file_name()?.to_str()?;
            let mm = p.parent()?.file_name()?.to_str()?;
            let yyyy = p.parent()?.parent()?.file_name()?.to_str()?;
            Some(format!("{yyyy}/{mm}/{dd}"))
        })
        .unwrap_or_default()
}

/// Quickly scan a JSONL file for session metadata without full parsing.
fn scan_session_file(path: &Path) -> Option<CodexSessionInfo> {
    let content = fs::read_to_string(path).ok()?;
    let mut lines = content.lines().filter(|l| !l.trim().is_empty());

    let first_line = lines.next()?;
    let first: Value = serde_json::from_str(first_line).ok()?;

    // Skip state placeholders
    if first.get("record_type").and_then(|t| t.as_str()) == Some("state") {
        return None;
    }

    let entry = RawEntry::parse(first_line)?;
    let payload = &entry.payload;
    let raw = &entry.raw;

    let (id, start_time, cwd, originator, cli_version, git_branch, _instructions) =
        match entry.entry_type.as_str() {
            "session_meta" => {
                let id = str_field(payload, "id");
                let start_time = str_field(payload, "timestamp");
                let cwd = opt_str(payload, "cwd");
                let originator = opt_str(payload, "originator");
                let cli_version = opt_str(payload, "cli_version");
                let git_branch = payload
                    .get("git")
                    .and_then(|g| g.get("branch"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let instructions: Option<String> = None; // not needed for picker
                (
                    id,
                    start_time,
                    cwd,
                    originator,
                    cli_version,
                    git_branch,
                    instructions,
                )
            }
            "session_meta_root" => {
                let id = str_field(raw, "id");
                let start_time = str_field(raw, "timestamp");
                let git_branch = raw
                    .get("git")
                    .and_then(|g| g.get("branch"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                (id, start_time, None, None, None, git_branch, None)
            }
            _ => return None,
        };

    if id.is_empty() {
        return None;
    }

    // Quick scan remaining lines for turn count, model, thread_name, tokens, end_time
    let mut turn_count: u32 = 0;
    let mut model: Option<String> = None;
    let mut thread_name: Option<String> = None;
    let mut total_tokens: Option<u64> = None;
    let mut end_time: Option<String> = None;
    let mut spawned_worker_ids: Vec<String> = Vec::new();
    let mut is_ongoing = true;

    for line in lines {
        if line.trim().is_empty() {
            continue;
        }
        let v: Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let t = v.get("type").and_then(|t| t.as_str()).unwrap_or("");
        match t {
            "event_msg" => {
                let pt = v
                    .get("payload")
                    .and_then(|p| p.get("type"))
                    .and_then(|t| t.as_str())
                    .unwrap_or("");
                match pt {
                    "task_started" => {
                        turn_count += 1;
                    }
                    "user_message" if turn_count == 0 => {
                        turn_count += 1;
                    }
                    "task_complete" => {
                        is_ongoing = false;
                        let payload = v.get("payload").unwrap_or(&Value::Null);
                        end_time = payload
                            .get("completed_at")
                            .and_then(|v| v.as_f64())
                            .map(|ts| {
                                use chrono::{DateTime, Utc};
                                DateTime::<Utc>::from_timestamp(ts as i64, 0)
                                    .map(|dt| dt.to_rfc3339())
                                    .unwrap_or_default()
                            })
                            .or_else(|| {
                                v.get("timestamp")
                                    .and_then(|v| v.as_str())
                                    .map(|s| s.to_string())
                            });
                    }
                    "turn_aborted" => {
                        is_ongoing = false;
                        end_time = v
                            .get("timestamp")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());
                    }
                    "token_count" => {
                        if let Some(info) = v
                            .get("payload")
                            .and_then(|p| p.get("info"))
                            .filter(|v| !v.is_null())
                        {
                            if let Some(ttu) = info.get("total_token_usage") {
                                total_tokens = ttu.get("total_tokens").and_then(|v| v.as_u64());
                            }
                        }
                    }
                    "thread_name_updated" => {
                        thread_name = v
                            .get("payload")
                            .and_then(|p| p.get("thread_name"))
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());
                    }
                    "collab_agent_spawn_end" => {
                        if let Some(new_id) = v
                            .get("payload")
                            .and_then(|p| p.get("new_thread_id"))
                            .and_then(|v| v.as_str())
                        {
                            spawned_worker_ids.push(new_id.to_string());
                        }
                    }
                    _ => {}
                }
            }
            "turn_context" => {
                // Always overwrite — spec says "most recent turn_context.payload.model"
                let m = v
                    .get("payload")
                    .and_then(|p| p.get("model"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                if m.is_some() {
                    model = m;
                }
            }
            _ => {}
        }
    }

    // Also count user_message events for old format (no task_started)
    // We already handle that above by incrementing on first "user_message"
    // For accuracy, re-scan and count task_started events specifically
    // (already done in the loop above — task_started increments turn_count)

    // Sessions with no turns have no active task — not ongoing regardless of event stream.
    if turn_count == 0 {
        is_ongoing = false;
    }

    // Validate with file mtime: sessions last modified more than 5 minutes ago
    // cannot be actively processing a turn, regardless of missing task_complete events.
    // Many older CLI versions didn't emit task_complete, causing false positives otherwise.
    if is_ongoing {
        const ONGOING_THRESHOLD_SECS: u64 = 300;
        if let Ok(metadata) = fs::metadata(path) {
            if let Ok(modified) = metadata.modified() {
                if let Ok(elapsed) = SystemTime::now().duration_since(modified) {
                    if elapsed.as_secs() > ONGOING_THRESHOLD_SECS {
                        is_ongoing = false;
                    }
                }
            }
        }
    }

    let date_group = date_group_from_path(path);
    let is_external_worker = originator.as_deref() == Some("codex_exec");

    Some(CodexSessionInfo {
        id,
        path: path.to_string_lossy().to_string(),
        cwd,
        git_branch,
        originator,
        model,
        cli_version,
        thread_name,
        turn_count,
        start_time,
        end_time,
        total_tokens,
        is_ongoing,
        is_external_worker,
        spawned_worker_ids,
        date_group,
    })
}

fn str_field(v: &Value, key: &str) -> String {
    v.get(key)
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string()
}

fn opt_str(v: &Value, key: &str) -> Option<String> {
    v.get(key)
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn date_group_from_path_test() {
        let path = PathBuf::from("/home/user/.codex/sessions/2026/04/25/rollout-abc.jsonl");
        let dg = date_group_from_path(&path);
        assert_eq!(dg, "2026/04/25");
    }
}
