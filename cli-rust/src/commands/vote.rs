use anyhow::{anyhow, Result};

use crate::api::ArkoraApi;
use crate::config;
use crate::theme;

pub async fn run(post_id: &str, up: bool, down: bool, undo: bool) -> Result<()> {
    let direction: i8 = if undo {
        0
    } else if up {
        1
    } else if down {
        -1
    } else {
        return Err(anyhow!("Specify --up, --down, or --undo"));
    };

    let cfg = config::load();
    let key = config::require_key(&cfg);
    let api = ArkoraApi::new(&config::api_url(&cfg), &key);

    let payload = serde_json::json!({ "postId": post_id, "direction": direction });
    api.post::<serde_json::Value>("/vote", &payload).await?;

    let msg = match direction {
        1 => theme::green("Upvoted."),
        -1 => theme::red("Downvoted."),
        _ => theme::dim("Vote removed."),
    };

    println!();
    println!("{msg}");
    println!();

    Ok(())
}
