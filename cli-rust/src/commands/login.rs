use anyhow::{anyhow, Result};
use colored::Colorize;
use qrcode::QrCode;
use serde::Deserialize;
use std::time::{Duration, Instant};

use crate::config;
use crate::theme;

#[derive(Deserialize)]
struct BridgeCreateResponse {
    success: bool,
    data: Option<BridgeCreateData>,
    error: Option<String>,
}

#[derive(Deserialize)]
struct BridgeCreateData {
    #[serde(rename = "connectorURI")]
    connector_uri: String,
    #[serde(rename = "sessionId")]
    session_id: String,
}

#[derive(Deserialize)]
struct BridgePollResponse {
    success: bool,
    data: Option<BridgePollData>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BridgePollData {
    status: String,
    api_key: Option<String>,
    #[allow(dead_code)]
    error: Option<String>,
    handle: Option<String>,
}

/// Renders a high-contrast QR code using Unicode half-blocks.
/// White modules on black background - optimal for scanning.
fn render_qr(url: &str) {
    let code = QrCode::new(url.as_bytes()).expect("Failed to generate QR code");
    let w = code.width();
    let colors = code.to_colors();

    // Check if module at (x, y) is dark. Quiet zone (out of bounds) = light.
    let is_dark = |x: i32, y: i32| -> bool {
        if x < 0 || y < 0 || x >= w as i32 || y >= w as i32 {
            return false;
        }
        colors[y as usize * w + x as usize] == qrcode::Color::Dark
    };

    // Add 1-module quiet zone on each side
    let start = -1i32;
    let end = w as i32 + 1;

    // Each character = 2 vertical pixels using half-block chars
    // Dark = black (terminal default), Light = white
    // We use inverted: print white blocks for light modules
    let rows = ((end - start) + 1) / 2;
    for row in 0..rows {
        let y_top = start + row * 2;
        let y_bot = y_top + 1;
        let mut line = String::from("  "); // left padding
        for x in start..end {
            let top_dark = is_dark(x, y_top);
            let bot_dark = is_dark(x, y_bot);
            // White-on-black: light modules are white, dark modules are black (default bg)
            let ch = match (top_dark, bot_dark) {
                (false, false) => "█".white().on_black(),  // both light = full white block
                (true, false) => "▄".white().on_black(),   // top dark, bot light
                (false, true) => "▀".white().on_black(),   // top light, bot dark
                (true, true) => " ".on_black(),             // both dark = space
            };
            line.push_str(&ch.to_string());
        }
        println!("{line}");
    }
}

pub async fn run(color: (u8, u8, u8)) -> Result<()> {
    let cfg = config::load();
    let base_url = config::api_url(&cfg);
    let client = reqwest::Client::builder()
        .user_agent("Arkora-CLI/2.0")
        .build()?;

    println!();
    println!("{}", theme::accent_bold("Arkora CLI Login", color));
    println!();
    println!("Connecting...");

    // 1. Create World ID bridge session via our server
    let resp = client
        .post(format!("{base_url}/api/cli/bridge"))
        .send()
        .await
        .map_err(|e| anyhow!("Could not reach server: {e}"))?;
    let text = resp.text().await?;
    let bridge: BridgeCreateResponse = serde_json::from_str(&text)
        .map_err(|e| anyhow!("Invalid server response: {e}"))?;

    if !bridge.success {
        return Err(anyhow!("{}", bridge.error.unwrap_or("Failed to start verification".into())));
    }

    let data = bridge.data.ok_or_else(|| anyhow!("No session data"))?;

    // 2. Display the World ID QR code
    println!();
    println!("Scan with {} to verify your identity:", "World App".bold());
    println!();
    render_qr(&data.connector_uri);
    println!();
    println!("{}", theme::dim(&data.connector_uri));
    println!();
    println!("Waiting for verification...");

    // 3. Poll our server
    let timeout = Duration::from_secs(300);
    let interval = Duration::from_secs(2);
    let start = Instant::now();

    loop {
        if start.elapsed() > timeout {
            return Err(anyhow!("Timed out. Run `arkora login` again."));
        }

        tokio::time::sleep(interval).await;

        let poll_resp = client
            .get(format!(
                "{base_url}/api/cli/bridge?sessionId={}",
                data.session_id
            ))
            .send()
            .await;

        let poll = match poll_resp {
            Ok(r) => {
                let t = r.text().await.unwrap_or_default();
                serde_json::from_str::<BridgePollResponse>(&t).ok()
            }
            Err(_) => continue,
        };

        if let Some(poll) = poll {
            if let Some(poll_data) = poll.data {
                match poll_data.status.as_str() {
                    "authorized" => {
                        if let Some(api_key) = poll_data.api_key {
                            let mut cfg = config::load();
                            cfg.api_key = Some(api_key);
                            config::save(&cfg)?;

                            println!();
                            if let Some(handle) = &poll_data.handle {
                                println!("{}", theme::accent_bold(&format!("Welcome, @{handle}"), color));
                            }
                            println!("{}", theme::green("Verified. Logged in successfully."));
                            if poll_data.handle.is_none() {
                                println!("{}", theme::dim("Open Arkora in World App to sync your username."));
                            }
                            println!("{}", theme::dim("Config saved to ~/.config/arkora/config.json"));
                            return Ok(());
                        }
                    }
                    "failed" => {
                        let err = poll_data.error.unwrap_or("Verification failed".into());
                        return Err(anyhow!("{err}"));
                    }
                    "expired" => {
                        return Err(anyhow!("Session expired. Run `arkora login` again."));
                    }
                    _ => {} // pending
                }
            }
        }
    }
}
