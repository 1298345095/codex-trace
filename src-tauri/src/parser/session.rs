use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::Path;
use std::time::SystemTime;

use super::entry::RawEntry;
use super::turn::{build_turns, CodexTurn, TokenInfo, TurnStatus};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitInfo {
    pub commit_hash: Option<String>,
    pub branch: Option<String>,
    pub repository_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodexSession {
    pub id: String,
    pub timestamp: String,
    pub cwd: Option<String>,
    pub originator: Option<String>,
    pub cli_version: Option<String>,
    pub model_provider: Option<String>,
    pub git: Option<GitInfo>,
    pub instructions: Option<String>,
    pub turns: Vec<CodexTurn>,
    pub is_ongoing: bool,
    pub total_tokens: Option<TokenInfo>,
    pub thread_name: Option<String>,
    pub spawned_worker_ids: Vec<String>,
    pub path: String,
}

/// Parse a Codex JSONL session file into a CodexSession.
pub fn parse_session(path: &Path) -> Result<CodexSession, String> {
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let entries: Vec<RawEntry> = content
        .lines()
        .filter(|l| !l.trim().is_empty())
        .filter_map(RawEntry::parse)
        .collect();

    let mut session = CodexSession {
        id: String::new(),
        timestamp: String::new(),
        cwd: None,
        originator: None,
        cli_version: None,
        model_provider: None,
        git: None,
        instructions: None,
        turns: Vec::new(),
        is_ongoing: false,
        total_tokens: None,
        thread_name: None,
        spawned_worker_ids: Vec::new(),
        path: path.to_string_lossy().to_string(),
    };

    // Parse session_meta from first matching entry
    for entry in &entries {
        match entry.entry_type.as_str() {
            "session_meta" => {
                parse_session_meta_new(&mut session, &entry.payload, &entry.raw);
                break;
            }
            "session_meta_root" => {
                parse_session_meta_root(&mut session, &entry.raw);
                break;
            }
            _ => {}
        }
    }

    // Build turns from remaining entries
    let mut turns = build_turns(&entries);

    // Extract thread_name from last thread_name_updated
    let thread_name = turns.iter().rev().find_map(|t| t.thread_name.clone());

    // Collect spawned_worker_ids from all turns
    let spawned_worker_ids: Vec<String> = turns
        .iter()
        .flat_map(|t| t.collab_spawns.iter().map(|s| s.new_thread_id.clone()))
        .collect();

    // Determine total tokens from last turn's token info
    let total_tokens = turns.iter().rev().find_map(|t| t.total_tokens.clone());

    // Determine is_ongoing: last turn must be Ongoing AND file must have been
    // modified within 60 seconds (same threshold as source repo). Sessions older
    // than that have no live CLI writing to them — task_complete was simply missed
    // (crash, kill, older CLI that never emitted the event).
    let turn_ongoing = turns
        .last()
        .map(|t| t.status == super::turn::TurnStatus::Ongoing)
        .unwrap_or(false);
    let file_fresh = fs::metadata(path)
        .and_then(|m| m.modified())
        .map(|mt| {
            SystemTime::now()
                .duration_since(mt)
                .map(|e| e.as_secs() <= 60)
                .unwrap_or(true)
        })
        .unwrap_or(true);
    let is_ongoing = turn_ongoing && file_fresh;

    // If the file is stale and the last turn never got a completion event,
    // mark it as Aborted so the UI doesn't show an ongoing indicator.
    if turn_ongoing && !file_fresh {
        if let Some(last) = turns.last_mut() {
            last.status = TurnStatus::Aborted;
        }
    }

    session.turns = turns;
    session.thread_name = thread_name;
    session.spawned_worker_ids = spawned_worker_ids;
    session.total_tokens = total_tokens;
    session.is_ongoing = is_ongoing;

    Ok(session)
}

fn parse_session_meta_new(session: &mut CodexSession, payload: &Value, _raw: &Value) {
    session.id = str_field(payload, "id");
    session.timestamp = str_field(payload, "timestamp");
    session.cwd = opt_str(payload, "cwd");
    session.originator = opt_str(payload, "originator");
    session.cli_version = opt_str(payload, "cli_version");
    session.model_provider = opt_str(payload, "model_provider");

    if let Some(git) = payload.get("git") {
        session.git = Some(GitInfo {
            commit_hash: opt_str(git, "commit_hash"),
            branch: opt_str(git, "branch"),
            repository_url: opt_str(git, "repository_url"),
        });
    }

    // Instructions: prefer base_instructions.text, fall back to instructions (flat string)
    session.instructions = payload
        .get("base_instructions")
        .and_then(|bi| bi.get("text"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or_else(|| opt_str(payload, "instructions"));
}

fn parse_session_meta_root(session: &mut CodexSession, raw: &Value) {
    session.id = str_field(raw, "id");
    session.timestamp = str_field(raw, "timestamp");
    // Oldest format: no cwd, originator, cli_version
    if let Some(git) = raw.get("git") {
        session.git = Some(GitInfo {
            commit_hash: opt_str(git, "commit_hash"),
            branch: opt_str(git, "branch"),
            repository_url: opt_str(git, "repository_url"),
        });
    }
    session.instructions = opt_str(raw, "instructions");
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

/// Returns the default Codex sessions directory: ~/.codex/sessions
pub fn default_sessions_dir() -> Option<std::path::PathBuf> {
    dirs::home_dir().map(|h| h.join(".codex").join("sessions"))
}

/// Resolve the sessions directory from settings or default.
pub fn resolve_sessions_dir(configured: Option<&str>) -> Result<std::path::PathBuf, String> {
    if let Some(p) = configured.filter(|s| !s.is_empty()) {
        return Ok(std::path::PathBuf::from(p));
    }
    default_sessions_dir().ok_or_else(|| "cannot determine home directory".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn default_sessions_dir_exists() {
        let dir = default_sessions_dir();
        assert!(dir.is_some());
    }

    fn find_first_jsonl(dir: &PathBuf) -> Option<PathBuf> {
        let rd = std::fs::read_dir(dir).ok()?;
        let mut children: Vec<PathBuf> = rd.filter_map(|e| e.ok()).map(|e| e.path()).collect();
        children.sort();
        for child in &children {
            if child.is_file() && child.extension().and_then(|s| s.to_str()) == Some("jsonl") {
                return Some(child.clone());
            }
            if child.is_dir() {
                if let Some(found) = find_first_jsonl(child) {
                    return Some(found);
                }
            }
        }
        None
    }

    #[test]
    fn parse_real_session_does_not_panic() {
        let home = std::env::var("HOME").expect("HOME not set");
        let sessions_root = PathBuf::from(home).join(".codex/sessions");
        if !sessions_root.exists() {
            return;
        }
        let Some(path) = find_first_jsonl(&sessions_root) else {
            return;
        };
        let result = parse_session(&path);
        assert!(result.is_ok(), "parse_session failed: {:?}", result.err());
        let session = result.unwrap();
        assert!(!session.id.is_empty(), "session id should not be empty");
    }
}
