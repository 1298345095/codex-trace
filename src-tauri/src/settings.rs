use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Settings {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sessions_dir: Option<String>,
}

fn settings_path() -> Result<PathBuf, String> {
    let config = dirs::config_dir().ok_or("no config directory")?;
    Ok(config.join("codex-trace").join("settings.json"))
}

pub fn load_settings() -> Settings {
    settings_path()
        .ok()
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save_settings(settings: &Settings) -> Result<(), String> {
    let path = settings_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_settings_has_no_sessions_dir() {
        let s = Settings::default();
        assert!(s.sessions_dir.is_none());
    }

    #[test]
    fn deserialize_empty_json_gives_defaults() {
        let s: Settings = serde_json::from_str("{}").unwrap();
        assert!(s.sessions_dir.is_none());
    }
}
