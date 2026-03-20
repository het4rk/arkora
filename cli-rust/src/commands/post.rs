use anyhow::Result;
use serde::Deserialize;

use crate::api::ArkoraApi;
use crate::config;
use crate::theme;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PostResult {
    id: String,
    title: String,
    board_id: String,
}

pub async fn run(title: &str, body: Option<&str>, board_id: &str, color: (u8, u8, u8)) -> Result<()> {
    let cfg = config::load();
    let key = config::require_key(&cfg);
    let api = ArkoraApi::new(&config::api_url(&cfg), &key);

    let mut payload = serde_json::json!({ "title": title, "boardId": board_id });
    if let Some(b) = body {
        payload["body"] = serde_json::Value::String(b.to_string());
    }

    let resp = api.post::<PostResult>("/posts", &payload).await?;
    let post = resp.data.ok_or_else(|| anyhow::anyhow!("No data in response"))?;

    println!();
    println!("{}", theme::accent("Post created.", color));
    println!("  {}", post.title);
    println!("  Board: {}", theme::board(&post.board_id, color));
    println!("  ID: {}", theme::dim(&post.id));
    println!();

    Ok(())
}
