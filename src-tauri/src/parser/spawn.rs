use serde_json::Value;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpawnAgentOutput {
    pub agent_id: String,
    pub nickname: String,
}

pub fn parse_spawn_agent_output(output: &str) -> Option<SpawnAgentOutput> {
    let parsed: Value = serde_json::from_str(output).ok()?;
    let agent_id = parsed.get("agent_id")?.as_str()?.to_string();
    if agent_id.is_empty() {
        return None;
    }

    let nickname = parsed
        .get("nickname")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    Some(SpawnAgentOutput { agent_id, nickname })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_spawn_agent_output() {
        let parsed = parse_spawn_agent_output(
            r#"{"agent_id":"019dcd48-57d3-7a42-9952-bb488d179d0f","nickname":"Parfit"}"#,
        )
        .unwrap();

        assert_eq!(parsed.agent_id, "019dcd48-57d3-7a42-9952-bb488d179d0f");
        assert_eq!(parsed.nickname, "Parfit");
    }

    #[test]
    fn ignores_non_json_spawn_agent_output() {
        assert!(
            parse_spawn_agent_output("Full-history forked agents inherit parent config").is_none()
        );
    }
}
