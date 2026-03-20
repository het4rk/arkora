use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skin_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_hex: Option<String>,
}

fn config_path() -> PathBuf {
    let dir = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("~/.config"))
        .join("arkora");
    dir.join("config.json")
}

pub fn load() -> Config {
    let path = config_path();
    match fs::read_to_string(&path) {
        Ok(data) => serde_json::from_str(&data).unwrap_or_default(),
        Err(_) => Config::default(),
    }
}

pub fn save(config: &Config) -> Result<()> {
    let path = config_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_string_pretty(config)?;
    fs::write(&path, format!("{json}\n"))?;
    // Restrict permissions - config contains API key
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600))?;
    }
    Ok(())
}

pub fn api_url(config: &Config) -> String {
    std::env::var("ARKORA_API_URL")
        .ok()
        .or_else(|| config.api_url.clone())
        .unwrap_or_else(|| "https://arkora.app".to_string())
}

pub fn require_key(config: &Config) -> String {
    match &config.api_key {
        Some(key) => key.clone(),
        None => {
            eprintln!("Not logged in. Run `arkora login` first.");
            std::process::exit(1);
        }
    }
}
