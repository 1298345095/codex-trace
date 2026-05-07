use serde_json::Value;

/// A raw JSONL line from a Codex session file, loosely typed.
#[derive(Debug, Clone)]
pub struct RawEntry {
    pub entry_type: String,
    pub timestamp: Option<String>,
    pub payload: Value,
    /// The raw line value (useful for oldest-format session_meta where fields are at root)
    pub raw: Value,
}

impl RawEntry {
    /// Parse a single JSONL line into a RawEntry.
    pub fn parse(line: &str) -> Option<Self> {
        let v: Value = serde_json::from_str(line).ok()?;

        // Skip "state" placeholder entries
        if v.get("record_type").and_then(|t| t.as_str()) == Some("state") {
            return None;
        }

        let entry_type = detect_entry_type(&v);
        let timestamp = v
            .get("timestamp")
            .and_then(|t| t.as_str())
            .map(|s| s.to_string());
        let payload = v.get("payload").cloned().unwrap_or(Value::Null);

        Some(RawEntry {
            entry_type,
            timestamp,
            payload,
            raw: v,
        })
    }
}

fn detect_entry_type(v: &Value) -> String {
    // Check explicit type field first
    if let Some(t) = v.get("type").and_then(|t| t.as_str()) {
        return t.to_string();
    }

    // Mid format: has payload but no type
    if v.get("payload").is_some() {
        return "session_meta".to_string();
    }

    // Oldest format: has id + timestamp at root
    if v.get("id").is_some() && v.get("timestamp").is_some() {
        return "session_meta_root".to_string();
    }

    // Bare old-format entries (cli_version < 0.44): function_call, function_call_output, message, reasoning
    if v.get("call_id").is_some() && v.get("arguments").is_some() && v.get("name").is_some() {
        return "function_call".to_string();
    }
    if v.get("call_id").is_some() && v.get("output").is_some() {
        return "function_call_output".to_string();
    }
    if v.get("role").is_some() && v.get("content").is_some() {
        return "message".to_string();
    }
    if v.get("encrypted_content").is_some() {
        return "reasoning".to_string();
    }

    "unknown".to_string()
}

/// Extract the event_msg payload type (e.g. "task_started", "user_message", etc.)
pub fn event_msg_type(payload: &Value) -> Option<&str> {
    payload.get("type").and_then(|t| t.as_str())
}

/// Parse an ISO timestamp string to Unix seconds (u64).
pub fn parse_timestamp_secs(ts: &str) -> Option<u64> {
    use chrono::DateTime;
    let dt = ts.parse::<DateTime<chrono::Utc>>().ok()?;
    Some(dt.timestamp() as u64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_new_session_meta() {
        let line = r#"{"timestamp":"2026-04-25T10:00:00Z","type":"session_meta","payload":{"id":"abc","cwd":"/tmp"}}"#;
        let e = RawEntry::parse(line).unwrap();
        assert_eq!(e.entry_type, "session_meta");
        assert_eq!(e.payload["id"], "abc");
    }

    #[test]
    fn parse_state_placeholder_returns_none() {
        let line = r#"{"record_type":"state"}"#;
        assert!(RawEntry::parse(line).is_none());
    }

    #[test]
    fn parse_event_msg() {
        let line = r#"{"timestamp":"2026-04-25T10:00:00Z","type":"event_msg","payload":{"type":"user_message","message":"hello"}}"#;
        let e = RawEntry::parse(line).unwrap();
        assert_eq!(e.entry_type, "event_msg");
        assert_eq!(event_msg_type(&e.payload), Some("user_message"));
    }

    #[test]
    fn parse_timestamp() {
        assert!(parse_timestamp_secs("2026-04-25T10:00:00Z").is_some());
    }

    #[test]
    fn parse_response_item() {
        let line = r#"{"timestamp":"2026-04-25T10:00:00Z","type":"response_item","payload":{"type":"function_call","name":"exec_command","call_id":"call_1"}}"#;
        let e = RawEntry::parse(line).unwrap();
        assert_eq!(e.entry_type, "response_item");
        assert_eq!(e.payload["type"], "function_call");
    }

    // `response_item` is a JSONL log entry type written by the Codex CLI into session
    // files. It is entirely unrelated to the `codex responses` CLI subcommand that was
    // removed in Codex v0.128.0 (PR #19640). This test guards against that confusion
    // and ensures all expected response_item payload types continue to parse correctly.
    #[test]
    fn response_item_payload_types_parsed_from_jsonl_not_cli_subcommand() {
        let cases = [
            (
                r#"{"timestamp":"2026-04-25T10:00:00Z","type":"response_item","payload":{"type":"function_call","name":"exec_command","call_id":"c1"}}"#,
                "function_call",
            ),
            (
                r#"{"timestamp":"2026-04-25T10:00:01Z","type":"response_item","payload":{"type":"function_call_output","call_id":"c1","output":"ok"}}"#,
                "function_call_output",
            ),
            (
                r#"{"timestamp":"2026-04-25T10:00:02Z","type":"response_item","payload":{"type":"message","role":"assistant","content":"hello"}}"#,
                "message",
            ),
            (
                r#"{"timestamp":"2026-04-25T10:00:03Z","type":"response_item","payload":{"type":"reasoning","encrypted_content":"..."}}"#,
                "reasoning",
            ),
        ];
        for (line, expected_payload_type) in cases {
            let e = RawEntry::parse(line).unwrap();
            assert_eq!(e.entry_type, "response_item");
            assert_eq!(e.payload["type"], expected_payload_type);
        }
    }
}
