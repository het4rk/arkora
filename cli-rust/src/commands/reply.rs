use anyhow::{anyhow, Result};
use serde::Deserialize;

use crate::api::ArkoraApi;
use crate::config;
use crate::theme;

#[derive(Deserialize)]
struct ReplyResult {
    id: String,
}

pub async fn run(post_id: &str, body: &str, color: (u8, u8, u8)) -> Result<()> {
    if body.trim().is_empty() {
        return Err(anyhow!("Reply body is required. Use --body \"your reply\""));
    }

    let cfg = config::load();
    let key = config::require_key(&cfg);
    let api = ArkoraApi::new(&config::api_url(&cfg), &key);

    let payload = serde_json::json!({ "postId": post_id, "body": body });
    let resp = api.post::<ReplyResult>("/replies", &payload).await?;
    let reply = resp.data.ok_or_else(|| anyhow::anyhow!("No data in response"))?;

    println!();
    println!("{}", theme::accent("Reply posted.", color));
    println!("  {}", theme::dim(&format!("ID: {}", reply.id)));
    println!();

    Ok(())
}
