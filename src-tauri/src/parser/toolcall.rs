use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ToolKind {
    ExecCommand,
    McpTool,
    PatchApply,
    WebSearch,
    ImageGeneration,
    SpawnAgent,
    WaitAgent,
    CloseAgent,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub call_id: String,
    pub kind: ToolKind,
    pub name: String,
    pub arguments: Value,
    pub input_text: Option<String>,
    pub output: Option<String>,
    pub exit_code: Option<i32>,
    pub command: Option<Vec<String>>,
    pub cwd: Option<String>,
    pub duration_secs: Option<f64>,
    pub mcp_server: Option<String>,
    pub mcp_tool: Option<String>,
    pub patch_success: Option<bool>,
    pub patch_changes: Option<Value>,
    pub web_query: Option<String>,
    pub web_url: Option<String>,
    pub image_prompt: Option<String>,
    pub status: String,
}

/// A pending (not yet finalized) tool call — waiting for its end event.
#[derive(Debug, Clone)]
pub struct PendingCall {
    pub name: String,
    pub arguments: Value,
    pub input_text: Option<String>,
}

/// Builder that collects function_call / custom_tool_call entries and finalizes
/// them when the corresponding end event arrives.
pub struct ToolCallBuilder {
    pub pending: HashMap<String, PendingCall>,
    pub finalized: Vec<ToolCall>,
}

impl ToolCallBuilder {
    pub fn new() -> Self {
        Self {
            pending: HashMap::new(),
            finalized: Vec::new(),
        }
    }

    /// Register a function_call (response_item).
    pub fn add_function_call(&mut self, call_id: String, name: String, arguments_str: &str) {
        let arguments = serde_json::from_str(arguments_str).unwrap_or(Value::Null);
        self.pending.insert(
            call_id,
            PendingCall {
                name,
                arguments,
                input_text: None,
            },
        );
    }

    /// Register a custom_tool_call (apply_patch etc).
    pub fn add_custom_tool_call(&mut self, call_id: String, name: String, input: Option<String>) {
        self.pending.insert(
            call_id,
            PendingCall {
                name,
                arguments: Value::Object(serde_json::Map::new()),
                input_text: input,
            },
        );
    }

    /// Register a function_call_output (no end event → Unknown kind).
    pub fn add_function_call_output(&mut self, call_id: &str, output: &str) {
        if let Some(pending) = self.pending.remove(call_id) {
            self.finalized.push(ToolCall {
                call_id: call_id.to_string(),
                kind: ToolKind::Unknown,
                name: pending.name,
                arguments: pending.arguments,
                input_text: pending.input_text,
                output: Some(output.to_string()),
                exit_code: None,
                command: None,
                cwd: None,
                duration_secs: None,
                mcp_server: None,
                mcp_tool: None,
                patch_success: None,
                patch_changes: None,
                web_query: None,
                web_url: None,
                image_prompt: None,
                status: "completed".to_string(),
            });
        }
    }

    /// Finalize with exec_command_end event.
    pub fn finalize_exec(&mut self, payload: &Value) {
        let call_id = str_field(payload, "call_id");
        let pending = self
            .pending
            .remove(&call_id)
            .unwrap_or_else(|| PendingCall {
                name: "exec_command".to_string(),
                arguments: Value::Null,
                input_text: None,
            });

        let command: Option<Vec<String>> = payload
            .get("command")
            .and_then(|c| serde_json::from_value(c.clone()).ok());
        let exit_code = payload
            .get("exit_code")
            .and_then(|v| v.as_i64())
            .map(|v| v as i32);
        let cwd = payload
            .get("cwd")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let duration_secs = parse_duration(payload);
        // aggregated_output carries the actual command output; stdout is often empty.
        let output = ["aggregated_output", "stdout", "formatted_output"]
            .iter()
            .find_map(|key| {
                payload
                    .get(*key)
                    .and_then(|v| v.as_str())
                    .filter(|s| !s.is_empty())
                    .map(|s| s.to_string())
            });
        let status = str_field(payload, "status");

        self.finalized.push(ToolCall {
            call_id,
            kind: ToolKind::ExecCommand,
            name: pending.name,
            arguments: pending.arguments,
            input_text: pending.input_text,
            output,
            exit_code,
            command,
            cwd,
            duration_secs,
            mcp_server: None,
            mcp_tool: None,
            patch_success: None,
            patch_changes: None,
            web_query: None,
            web_url: None,
            image_prompt: None,
            status,
        });
    }

    /// Finalize with mcp_tool_call_end event.
    pub fn finalize_mcp(&mut self, payload: &Value) {
        let call_id = str_field(payload, "call_id");
        let pending = self
            .pending
            .remove(&call_id)
            .unwrap_or_else(|| PendingCall {
                name: "mcp_tool".to_string(),
                arguments: Value::Null,
                input_text: None,
            });

        // Extract server + tool from name (mcp__server__tool) or invocation field
        let (mcp_server, mcp_tool) = if let Some(inv) = payload.get("invocation") {
            let server = inv
                .get("server")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let tool = inv
                .get("tool")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            (server, tool)
        } else {
            parse_mcp_name(&pending.name)
        };

        // Extract output text from result.Ok.content[].text
        let output = extract_mcp_output(payload);
        let duration_secs = parse_duration(payload);

        self.finalized.push(ToolCall {
            call_id,
            kind: ToolKind::McpTool,
            name: pending.name,
            arguments: pending.arguments,
            input_text: pending.input_text,
            output,
            exit_code: None,
            command: None,
            cwd: None,
            duration_secs,
            mcp_server,
            mcp_tool,
            patch_success: None,
            patch_changes: None,
            web_query: None,
            web_url: None,
            image_prompt: None,
            status: "completed".to_string(),
        });
    }

    /// Finalize with patch_apply_end event.
    pub fn finalize_patch(&mut self, payload: &Value) {
        let call_id = str_field(payload, "call_id");
        let pending = self
            .pending
            .remove(&call_id)
            .unwrap_or_else(|| PendingCall {
                name: "apply_patch".to_string(),
                arguments: Value::Null,
                input_text: None,
            });

        let patch_success = payload.get("success").and_then(|v| v.as_bool());
        let patch_changes = payload.get("changes").cloned();
        let stdout = payload
            .get("stdout")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        self.finalized.push(ToolCall {
            call_id,
            kind: ToolKind::PatchApply,
            name: pending.name,
            arguments: pending.arguments,
            input_text: pending.input_text,
            output: stdout,
            exit_code: None,
            command: None,
            cwd: None,
            duration_secs: None,
            mcp_server: None,
            mcp_tool: None,
            patch_success,
            patch_changes,
            web_query: None,
            web_url: None,
            image_prompt: None,
            status: str_field(payload, "status"),
        });
    }

    /// Finalize with collab_agent_spawn_end event.
    pub fn finalize_spawn(&mut self, payload: &Value) {
        let call_id = str_field(payload, "call_id");
        let _ = self.pending.remove(&call_id);

        self.finalized.push(ToolCall {
            call_id,
            kind: ToolKind::SpawnAgent,
            name: "spawn_agent".to_string(),
            arguments: payload.clone(),
            input_text: None,
            output: None,
            exit_code: None,
            command: None,
            cwd: None,
            duration_secs: None,
            mcp_server: None,
            mcp_tool: None,
            patch_success: None,
            patch_changes: None,
            web_query: None,
            web_url: None,
            image_prompt: None,
            status: str_field(payload, "status"),
        });
    }

    /// Finalize with collab_waiting_end event.
    pub fn finalize_wait(&mut self, payload: &Value) {
        let call_id = str_field(payload, "call_id");
        let _ = self.pending.remove(&call_id);

        self.finalized.push(ToolCall {
            call_id,
            kind: ToolKind::WaitAgent,
            name: "wait_agent".to_string(),
            arguments: payload.clone(),
            input_text: None,
            output: None,
            exit_code: None,
            command: None,
            cwd: None,
            duration_secs: None,
            mcp_server: None,
            mcp_tool: None,
            patch_success: None,
            patch_changes: None,
            web_query: None,
            web_url: None,
            image_prompt: None,
            status: "completed".to_string(),
        });
    }

    /// Finalize with collab_close_end event.
    pub fn finalize_close(&mut self, payload: &Value) {
        let call_id = str_field(payload, "call_id");
        let _ = self.pending.remove(&call_id);

        self.finalized.push(ToolCall {
            call_id,
            kind: ToolKind::CloseAgent,
            name: "close_agent".to_string(),
            arguments: payload.clone(),
            input_text: None,
            output: None,
            exit_code: None,
            command: None,
            cwd: None,
            duration_secs: None,
            mcp_server: None,
            mcp_tool: None,
            patch_success: None,
            patch_changes: None,
            web_query: None,
            web_url: None,
            image_prompt: None,
            status: "completed".to_string(),
        });
    }

    /// Finalize web_search (no call_id pairing — best-effort).
    pub fn add_web_search(&mut self, payload: &Value) {
        let call_id = str_field(payload, "call_id");
        let query = payload
            .get("query")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let web_url = payload
            .get("action")
            .and_then(|a| a.get("url"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        self.finalized.push(ToolCall {
            call_id,
            kind: ToolKind::WebSearch,
            name: "web_search".to_string(),
            arguments: payload.clone(),
            input_text: None,
            output: None,
            exit_code: None,
            command: None,
            cwd: None,
            duration_secs: None,
            mcp_server: None,
            mcp_tool: None,
            patch_success: None,
            patch_changes: None,
            web_query: query,
            web_url,
            image_prompt: None,
            status: "completed".to_string(),
        });
    }

    /// Drain any remaining pending calls as Unknown (no end event arrived).
    pub fn drain_pending(&mut self) {
        let pending: Vec<(String, PendingCall)> = self.pending.drain().collect();
        for (call_id, p) in pending {
            self.finalized.push(ToolCall {
                call_id,
                kind: ToolKind::Unknown,
                name: p.name,
                arguments: p.arguments,
                input_text: p.input_text,
                output: None,
                exit_code: None,
                command: None,
                cwd: None,
                duration_secs: None,
                mcp_server: None,
                mcp_tool: None,
                patch_success: None,
                patch_changes: None,
                web_query: None,
                web_url: None,
                image_prompt: None,
                status: "unknown".to_string(),
            });
        }
        // Remove Unknown entries that share a call_id with a properly classified end-event entry.
        // This happens when function_call_output arrives before exec_command_end for the same
        // call_id — the output is finalized as Unknown first, then the end event adds the real entry.
        let paired: HashSet<String> = self
            .finalized
            .iter()
            .filter(|tc| tc.kind != ToolKind::Unknown)
            .map(|tc| tc.call_id.clone())
            .collect();
        self.finalized
            .retain(|tc| tc.kind != ToolKind::Unknown || !paired.contains(&tc.call_id));
    }
}

fn str_field(v: &Value, key: &str) -> String {
    v.get(key)
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string()
}

fn parse_duration(v: &Value) -> Option<f64> {
    let dur = v.get("duration")?;
    let secs = dur.get("secs")?.as_f64()?;
    let nanos = dur.get("nanos").and_then(|n| n.as_f64()).unwrap_or(0.0);
    Some(secs + nanos / 1_000_000_000.0)
}

fn parse_mcp_name(name: &str) -> (Option<String>, Option<String>) {
    let parts: Vec<&str> = name.split("__").collect();
    if parts.len() >= 3 && parts[0] == "mcp" {
        (Some(parts[1].to_string()), Some(parts[2..].join("__")))
    } else {
        (Some("codex".to_string()), Some(name.to_string()))
    }
}

fn extract_mcp_output(payload: &Value) -> Option<String> {
    let content = payload
        .get("result")
        .and_then(|r| r.get("Ok"))
        .and_then(|ok| ok.get("content"))
        .and_then(|c| c.as_array())?;

    let texts: Vec<&str> = content
        .iter()
        .filter(|item| item.get("type").and_then(|t| t.as_str()) == Some("text"))
        .filter_map(|item| item.get("text").and_then(|t| t.as_str()))
        .collect();

    if texts.is_empty() {
        None
    } else {
        Some(texts.join("\n"))
    }
}
