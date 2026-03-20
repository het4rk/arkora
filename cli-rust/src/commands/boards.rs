use anyhow::Result;
use serde::Deserialize;

use crate::api::ArkoraApi;
use crate::config;
use crate::theme;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Board {
    id: String,
    label: String,
    post_count: i64,
}

pub async fn run(color: (u8, u8, u8)) -> Result<()> {
    let cfg = config::load();
    let key = config::require_key(&cfg);
    let api = ArkoraApi::new(&config::api_url(&cfg), &key);

    let resp = api.get::<Vec<Board>>("/boards").await?;
    let boards = resp.data.unwrap_or_default();

    if boards.is_empty() {
        println!("{}", theme::dim("No boards found."));
        return Ok(());
    }

    println!();
    println!("{}", theme::accent_bold("Boards", color));
    println!();

    for b in &boards {
        println!(
            "  {:<20}  {:<20}  {}",
            theme::board(&b.id, color),
            b.label,
            theme::dim(&format!("{} posts", b.post_count))
        );
    }
    println!();

    Ok(())
}
