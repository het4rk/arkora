use anyhow::Result;
use serde::Deserialize;

use crate::api::ArkoraApi;
use crate::config;
use crate::theme;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Stats {
    total_posts: i64,
    total_polls: i64,
    total_verified_humans: i64,
    total_poll_votes: i64,
}

pub async fn run(color: (u8, u8, u8)) -> Result<()> {
    let cfg = config::load();
    let key = config::require_key(&cfg);
    let api = ArkoraApi::new(&config::api_url(&cfg), &key);

    let resp = api.get::<Stats>("/stats").await?;
    let s = resp.data.ok_or_else(|| anyhow::anyhow!("No data in response"))?;

    println!();
    println!("{}", theme::accent_bold("Arkora Stats", color));
    println!();
    println!("  Posts:      {}", theme::accent(&s.total_posts.to_string(), color));
    println!("  Polls:      {}", theme::accent(&s.total_polls.to_string(), color));
    println!("  Humans:     {}", theme::accent(&s.total_verified_humans.to_string(), color));
    println!("  Poll votes: {}", theme::accent(&s.total_poll_votes.to_string(), color));
    println!();

    Ok(())
}
