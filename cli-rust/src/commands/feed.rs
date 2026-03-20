use anyhow::Result;
use serde::Deserialize;

use crate::api::ArkoraApi;
use crate::config;
use crate::theme;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Post {
    id: String,
    title: String,
    body: Option<String>,
    board_id: String,
    upvotes: i64,
    downvotes: i64,
    reply_count: i64,
    created_at: String,
    author: Author,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Author {
    handle: Option<String>,
}

fn time_ago(date: &str) -> String {
    let Ok(dt) = chrono::DateTime::parse_from_rfc3339(date) else {
        return date.get(..10).unwrap_or(date).to_string();
    };
    let diff = chrono::Utc::now().signed_duration_since(dt);
    if diff.num_minutes() < 60 {
        format!("{}m", diff.num_minutes())
    } else if diff.num_hours() < 24 {
        format!("{}h", diff.num_hours())
    } else {
        format!("{}d", diff.num_days())
    }
}

pub async fn run(board_filter: Option<String>, limit: u32, color: (u8, u8, u8)) -> Result<()> {
    let cfg = config::load();
    let key = config::require_key(&cfg);
    let api = ArkoraApi::new(&config::api_url(&cfg), &key);

    let mut params = vec![format!("limit={limit}")];
    if let Some(b) = &board_filter {
        params.push(format!("boardId={b}"));
    }
    let query = params.join("&");
    let path = format!("/posts?{query}");

    let resp = api.get::<Vec<Post>>(&path).await?;
    let posts = resp.data.unwrap_or_default();

    if posts.is_empty() {
        println!("{}", theme::dim("No posts found."));
        return Ok(());
    }

    println!();
    for post in &posts {
        let author = post
            .author
            .handle
            .as_deref()
            .map(|h| h.to_string())
            .unwrap_or_else(|| theme::dim("anon"));
        let votes = format!(
            "{} {}",
            theme::green(&format!("+{}", post.upvotes)),
            theme::red(&format!("-{}", post.downvotes))
        );
        let replies = theme::dim(&format!("{} replies", post.reply_count));
        let time = theme::dim(&time_ago(&post.created_at));
        let id_short = theme::dim(&post.id.get(..8).unwrap_or(&post.id));

        println!(
            "{}  {id_short}",
            theme::accent_bold(&post.title, color)
        );
        println!(
            "  {author} in {}  {votes}  {replies}  {time}",
            theme::board(&post.board_id, color)
        );
        if let Some(body) = &post.body {
            if !body.is_empty() {
                let preview = if body.chars().count() > 120 {
                    format!("{}...", body.chars().take(120).collect::<String>())
                } else {
                    body.clone()
                };
                println!("  {}", theme::dim(&preview));
            }
        }
        println!();
    }

    Ok(())
}
