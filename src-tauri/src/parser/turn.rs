use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

use super::entry::{parse_timestamp_secs, RawEntry};
use super::toolcall::{ToolCall, ToolCallBuilder};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TurnStatus {
    Complete,
    Aborted,
    Ongoing,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMsg {
    pub text: String,
    pub phase: Option<String>,
    pub timestamp: String,
    pub is_reasoning: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenInfo {
    pub input_tokens: u64,
    pub cached_input_tokens: u64,
    pub output_tokens: u64,
    pub reasoning_output_tokens: u64,
    pub total_tokens: u64,
    pub model_context_window: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollabSpawn {
    pub call_id: String,
    pub new_thread_id: String,
    pub agent_nickname: String,
    pub agent_role: String,
    pub model: Option<String>,
    pub reasoning_effort: Option<String>,
    pub prompt_preview: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextElement {
    pub placeholder: String,
    pub byte_range: ByteRange,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ByteRange {
    pub start: usize,
    pub end: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodexTurn {
    pub turn_id: String,
    pub started_at: Option<u64>,
    pub completed_at: Option<u64>,
    pub duration_ms: Option<u64>,
    pub status: TurnStatus,
    pub user_message: Option<String>,
    pub text_elements: Vec<TextElement>,
    pub agent_messages: Vec<AgentMsg>,
    pub tool_calls: Vec<ToolCall>,
    pub final_answer: Option<String>,
    pub total_tokens: Option<TokenInfo>,
    pub model: Option<String>,
    pub cwd: Option<String>,
    pub reasoning_effort: Option<String>,
    pub error: Option<String>,
    pub aborted_reason: Option<String>,
    pub has_compaction: bool,
    pub thread_name: Option<String>,
    pub collab_spawns: Vec<CollabSpawn>,
}

impl CodexTurn {
    pub fn new(turn_id: String) -> Self {
        CodexTurn {
            turn_id,
            started_at: None,
            completed_at: None,
            duration_ms: None,
            status: TurnStatus::Ongoing,
            user_message: None,
            text_elements: Vec::new(),
            agent_messages: Vec::new(),
            tool_calls: Vec::new(),
            final_answer: None,
            total_tokens: None,
            model: None,
            cwd: None,
            reasoning_effort: None,
            error: None,
            aborted_reason: None,
            has_compaction: false,
            thread_name: None,
            collab_spawns: Vec::new(),
        }
    }
}

/// Build turns from a sequence of raw entries.
/// Handles both new format (task_started/task_complete) and old format (user_message-bounded).
pub fn build_turns(entries: &[RawEntry]) -> Vec<CodexTurn> {
    let mut turns: indexmap::IndexMap<String, CodexTurn> = indexmap::IndexMap::new();
    let mut current_turn_id: Option<String> = None;
    let mut tool_builders: HashMap<String, ToolCallBuilder> = HashMap::new();

    // Detect format: new (has task_started) vs old (user_message-bounded)
    let has_task_started = entries.iter().any(|e| {
        e.entry_type == "event_msg"
            && e.payload.get("type").and_then(|t| t.as_str()) == Some("task_started")
    });

    let mut synthetic_turn_counter = 0u32;

    for entry in entries {
        match entry.entry_type.as_str() {
            "event_msg" => {
                handle_event_msg(
                    entry,
                    &mut turns,
                    &mut current_turn_id,
                    &mut tool_builders,
                    has_task_started,
                    &mut synthetic_turn_counter,
                );
            }
            "response_item"
            | "function_call"
            | "function_call_output"
            | "message"
            | "reasoning" => {
                handle_response_item(entry, &mut turns, &current_turn_id, &mut tool_builders);
            }
            "turn_context" => {
                handle_turn_context(entry, &mut turns, &current_turn_id);
            }
            "compacted" => {
                if let Some(ref tid) = current_turn_id {
                    if let Some(turn) = turns.get_mut(tid) {
                        turn.has_compaction = true;
                    }
                }
            }
            _ => {}
        }
    }

    // Finalize all tool builders
    for (turn_id, mut builder) in tool_builders {
        builder.drain_pending();
        if let Some(turn) = turns.get_mut(&turn_id) {
            turn.tool_calls.extend(builder.finalized);
        }
    }

    let mut result: Vec<CodexTurn> = turns.into_values().collect();
    result.sort_by_key(|t| t.started_at.unwrap_or(0));
    result
}

fn handle_event_msg(
    entry: &RawEntry,
    turns: &mut indexmap::IndexMap<String, CodexTurn>,
    current_turn_id: &mut Option<String>,
    tool_builders: &mut HashMap<String, ToolCallBuilder>,
    has_task_started: bool,
    synthetic_counter: &mut u32,
) {
    let payload = &entry.payload;
    let msg_type = match payload.get("type").and_then(|t| t.as_str()) {
        Some(t) => t,
        None => return,
    };
    let ts = entry.timestamp.as_deref().unwrap_or("");

    match msg_type {
        "task_started" => {
            let turn_id = payload
                .get("turn_id")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            if turn_id.is_empty() {
                return;
            }
            let started_at = entry.timestamp.as_deref().and_then(parse_timestamp_secs);
            let mut turn = CodexTurn::new(turn_id.clone());
            turn.started_at = started_at;
            turns.insert(turn_id.clone(), turn);
            *current_turn_id = Some(turn_id.clone());
            tool_builders
                .entry(turn_id)
                .or_insert_with(ToolCallBuilder::new);
        }

        "user_message" => {
            let message = payload
                .get("message")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            if !has_task_started {
                // Old format: each user_message starts a new turn
                *synthetic_counter += 1;
                let turn_id = format!("turn-{synthetic_counter}");
                let started_at = entry.timestamp.as_deref().and_then(parse_timestamp_secs);
                let mut turn = CodexTurn::new(turn_id.clone());
                turn.started_at = started_at;
                turn.user_message = Some(message.clone());
                turns.insert(turn_id.clone(), turn);
                *current_turn_id = Some(turn_id.clone());
                tool_builders
                    .entry(turn_id)
                    .or_insert_with(ToolCallBuilder::new);
            } else if let Some(ref tid) = current_turn_id {
                if let Some(turn) = turns.get_mut(tid) {
                    if turn.user_message.is_none() {
                        turn.user_message = Some(message);
                    }
                }
            }
        }

        "agent_message" => {
            if let Some(ref tid) = current_turn_id {
                if let Some(turn) = turns.get_mut(tid) {
                    let text = payload
                        .get("message")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    if !text.is_empty() {
                        let phase = payload
                            .get("phase")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());
                        let is_final = phase.as_deref() == Some("final_answer");
                        if is_final && turn.final_answer.is_none() {
                            turn.final_answer = Some(text.clone());
                        }
                        turn.agent_messages.push(AgentMsg {
                            text,
                            phase,
                            timestamp: ts.to_string(),
                            is_reasoning: false,
                        });
                    }
                }
            }
        }

        "agent_reasoning" => {
            if let Some(ref tid) = current_turn_id {
                if let Some(turn) = turns.get_mut(tid) {
                    let text = payload
                        .get("text")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    if !text.is_empty() {
                        turn.agent_messages.push(AgentMsg {
                            text,
                            phase: None,
                            timestamp: ts.to_string(),
                            is_reasoning: true,
                        });
                    }
                }
            }
        }

        "task_complete" => {
            let turn_id = payload
                .get("turn_id")
                .and_then(|v| v.as_str())
                .unwrap_or(current_turn_id.as_deref().unwrap_or(""))
                .to_string();
            if let Some(turn) = turns.get_mut(&turn_id) {
                turn.status = TurnStatus::Complete;
                // Prefer task_complete.last_agent_message as final_answer
                if let Some(last_msg) = payload
                    .get("last_agent_message")
                    .and_then(|v| v.as_str())
                    .filter(|s| !s.is_empty())
                {
                    turn.final_answer = Some(last_msg.to_string());
                }
                turn.completed_at = payload
                    .get("completed_at")
                    .and_then(|v| v.as_f64())
                    .map(|v| v as u64)
                    .or_else(|| entry.timestamp.as_deref().and_then(parse_timestamp_secs));
                turn.duration_ms = payload.get("duration_ms").and_then(|v| v.as_u64());
            }
        }

        "turn_aborted" => {
            let turn_id_field = payload
                .get("turn_id")
                .and_then(|v| v.as_str())
                .unwrap_or(current_turn_id.as_deref().unwrap_or(""))
                .to_string();
            let target_id = if !turn_id_field.is_empty() {
                turn_id_field
            } else {
                current_turn_id.clone().unwrap_or_default()
            };
            if let Some(turn) = turns.get_mut(&target_id) {
                turn.status = TurnStatus::Aborted;
                turn.aborted_reason = payload
                    .get("reason")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                turn.completed_at = payload
                    .get("completed_at")
                    .and_then(|v| v.as_f64())
                    .map(|v| v as u64)
                    .or_else(|| entry.timestamp.as_deref().and_then(parse_timestamp_secs));
                turn.duration_ms = payload.get("duration_ms").and_then(|v| v.as_u64());
            }
        }

        "token_count" => {
            if let Some(ref tid) = current_turn_id {
                if let Some(turn) = turns.get_mut(tid) {
                    if let Some(info) = payload.get("info").filter(|v| !v.is_null()) {
                        if let Some(total) = info.get("total_token_usage") {
                            turn.total_tokens = Some(TokenInfo {
                                input_tokens: u64_field(total, "input_tokens"),
                                cached_input_tokens: u64_field(total, "cached_input_tokens"),
                                output_tokens: u64_field(total, "output_tokens"),
                                reasoning_output_tokens: u64_field(
                                    total,
                                    "reasoning_output_tokens",
                                ),
                                total_tokens: u64_field(total, "total_tokens"),
                                model_context_window: u64_field(info, "model_context_window"),
                            });
                        }
                    }
                }
            }
        }

        "error" => {
            if let Some(ref tid) = current_turn_id {
                if let Some(turn) = turns.get_mut(tid) {
                    let msg = payload
                        .get("message")
                        .and_then(|v| v.as_str())
                        .unwrap_or("unknown error")
                        .to_string();
                    turn.status = TurnStatus::Error;
                    turn.error = Some(msg);
                }
            }
        }

        "exec_command_end" => {
            if let Some(ref tid) = current_turn_id {
                let builder = tool_builders
                    .entry(tid.clone())
                    .or_insert_with(ToolCallBuilder::new);
                builder.finalize_exec(msg_type, payload);
            }
        }

        "mcp_tool_call_end" => {
            if let Some(ref tid) = current_turn_id {
                let builder = tool_builders
                    .entry(tid.clone())
                    .or_insert_with(ToolCallBuilder::new);
                builder.finalize_mcp(msg_type, payload);
            }
        }

        "patch_apply_end" => {
            if let Some(ref tid) = current_turn_id {
                let builder = tool_builders
                    .entry(tid.clone())
                    .or_insert_with(ToolCallBuilder::new);
                builder.finalize_patch(msg_type, payload);
            }
        }

        "web_search_end" => {
            if let Some(ref tid) = current_turn_id {
                let builder = tool_builders
                    .entry(tid.clone())
                    .or_insert_with(ToolCallBuilder::new);
                builder.add_web_search(msg_type, payload);
            }
        }

        "collab_agent_spawn_end" => {
            if let Some(ref tid) = current_turn_id {
                // Record collab spawn metadata
                if let Some(turn) = turns.get_mut(tid) {
                    let call_id = str_field(payload, "call_id");
                    let new_thread_id = str_field(payload, "new_thread_id");
                    let agent_nickname = str_field(payload, "new_agent_nickname");
                    let agent_role = str_field(payload, "new_agent_role");
                    let model = payload
                        .get("model")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    let reasoning_effort = payload
                        .get("reasoning_effort")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    let prompt = payload.get("prompt").and_then(|v| v.as_str()).unwrap_or("");
                    let prompt_preview = prompt.chars().take(200).collect();

                    turn.collab_spawns.push(CollabSpawn {
                        call_id: call_id.clone(),
                        new_thread_id,
                        agent_nickname,
                        agent_role,
                        model,
                        reasoning_effort,
                        prompt_preview,
                    });
                }

                let builder = tool_builders
                    .entry(tid.clone())
                    .or_insert_with(ToolCallBuilder::new);
                builder.finalize_spawn(msg_type, payload);
            }
        }

        "collab_waiting_end" => {
            if let Some(ref tid) = current_turn_id {
                let builder = tool_builders
                    .entry(tid.clone())
                    .or_insert_with(ToolCallBuilder::new);
                builder.finalize_wait(msg_type, payload);
            }
        }

        "collab_close_end" => {
            if let Some(ref tid) = current_turn_id {
                let builder = tool_builders
                    .entry(tid.clone())
                    .or_insert_with(ToolCallBuilder::new);
                builder.finalize_close(msg_type, payload);
            }
        }

        other if other.ends_with("_end") => {
            if let Some(ref tid) = current_turn_id {
                let builder = tool_builders
                    .entry(tid.clone())
                    .or_insert_with(ToolCallBuilder::new);
                builder.finalize_unknown_end(other, payload);
            }
        }

        "thread_name_updated" => {
            if let Some(ref tid) = current_turn_id {
                if let Some(turn) = turns.get_mut(tid) {
                    turn.thread_name = payload
                        .get("thread_name")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                }
            }
        }

        _ => {}
    }
}

fn handle_response_item(
    entry: &RawEntry,
    _turns: &mut indexmap::IndexMap<String, CodexTurn>,
    current_turn_id: &Option<String>,
    tool_builders: &mut HashMap<String, ToolCallBuilder>,
) {
    let payload = if entry.entry_type == "response_item" {
        &entry.payload
    } else {
        &entry.raw
    };

    let item_type = match payload.get("type").and_then(|t| t.as_str()) {
        Some(t) => t,
        None => return,
    };

    let tid = match current_turn_id {
        Some(t) => t,
        None => return,
    };

    let builder = tool_builders
        .entry(tid.clone())
        .or_insert_with(ToolCallBuilder::new);

    match item_type {
        "function_call" => {
            let call_id = str_field(payload, "call_id");
            let name = str_field(payload, "name");
            let arguments_str = payload
                .get("arguments")
                .and_then(|v| v.as_str())
                .unwrap_or("{}");
            builder.add_function_call(call_id, name, arguments_str);
        }

        "function_call_output" => {
            let call_id = str_field(payload, "call_id");
            let output = match payload.get("output") {
                Some(Value::String(s)) => s.clone(),
                Some(Value::Array(arr)) => arr
                    .iter()
                    .filter_map(|item| item.get("text").and_then(|t| t.as_str()))
                    .collect::<Vec<_>>()
                    .join(""),
                _ => String::new(),
            };
            builder.add_function_call_output(&call_id, &output);
        }

        "custom_tool_call" => {
            let call_id = str_field(payload, "call_id");
            let name = str_field(payload, "name");
            let input = payload
                .get("input")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            builder.add_custom_tool_call(call_id, name, input);
        }

        _ => {}
    }
}

fn handle_turn_context(
    entry: &RawEntry,
    turns: &mut indexmap::IndexMap<String, CodexTurn>,
    current_turn_id: &Option<String>,
) {
    let payload = &entry.payload;
    let model = payload
        .get("model")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let cwd = payload
        .get("cwd")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let effort = payload
        .get("effort")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    if let Some(ref tid) = current_turn_id {
        if let Some(turn) = turns.get_mut(tid) {
            if model.is_some() {
                turn.model = model;
            }
            if cwd.is_some() {
                turn.cwd = cwd;
            }
            if effort.is_some() {
                turn.reasoning_effort = effort;
            }
        }
    }
}

fn u64_field(v: &Value, key: &str) -> u64 {
    v.get(key).and_then(|v| v.as_u64()).unwrap_or(0)
}

fn str_field(v: &Value, key: &str) -> String {
    v.get(key)
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string()
}
