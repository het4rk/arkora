use anyhow::Result;
use serde::Deserialize;

use crate::api::ArkoraApi;
use crate::config;
use crate::theme;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Post {
    title: String,
    body: Option<String>,
    board_id: String,
    upvotes: i64,
    downvotes: i64,
    reply_count: i64,
    view_count: i64,
    created_at: String,
    author: Author,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Reply {
    body: String,
    upvotes: i64,
    downvotes: i64,
    created_at: String,
    parent_reply_id: Option<String>,
    author: Author,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Author {
    handle: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PollResults {
    total_votes: i64,
    options: Vec<PollOption>,
}

#[derive(Deserialize)]
struct PollOption {
    text: String,
    votes: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ViewData {
    post: Post,
    replies: Vec<Reply>,
    poll_results: Option<PollResults>,
}

fn time_ago(date: &str) -> String {
    let Ok(dt) = chrono::DateTime::parse_from_rfc3339(date) else {
        return date[..10].to_string();
    };
    let diff = chrono::Utc::now().signed_duration_since(dt);
    if diff.num_minutes() < 60 {
        format!("{}m ago", diff.num_minutes())
    } else if diff.num_hours() < 24 {
        format!("{}h ago", diff.num_hours())
    } else {
        format!("{}d ago", diff.num_days())
    }
}

pub async fn run(id: &str, color: (u8, u8, u8)) -> Result<()> {
    let cfg = config::load();
    let key = config::require_key(&cfg);
    let api = ArkoraApi::new(&config::api_url(&cfg), &key);

    let resp = api.get::<ViewData>(&format!("/posts/{id}")).await?;
    let data = resp.data.unwrap();
    let post = &data.post;

    let author = post
        .author
        .handle
        .as_deref()
        .map(|h| h.to_string())
        .unwrap_or_else(|| theme::dim("anon"));

    println!();
    println!("{}", theme::accent_bold(&post.title, color));
    println!(
        "{author} in {}  {}",
        theme::board(&post.board_id, color),
        theme::dim(&time_ago(&post.created_at))
    );
    println!(
        "{} {}  {}  {}",
        theme::green(&format!("+{}", post.upvotes)),
        theme::red(&format!("-{}", post.downvotes)),
        theme::dim(&format!("{} replies", post.reply_count)),
        theme::dim(&format!("{} views", post.view_count))
    );

    if let Some(body) = &post.body {
        if !body.is_empty() {
            println!();
            println!("{body}");
        }
    }

    // Poll results
    if let Some(poll) = &data.poll_results {
        if !poll.options.is_empty() {
            println!();
            println!("{}", theme::accent_bold("Poll", color));
            let total = poll.total_votes.max(1);
            for opt in &poll.options {
                let pct = (opt.votes as f64 / total as f64 * 100.0) as u32;
                let bar_len = (pct / 5).max(1) as usize;
                let bar = theme::accent(&"█".repeat(bar_len), color);
                println!(
                    "  {bar} {pct}%  {}  {}",
                    opt.text,
                    theme::dim(&format!("({})", opt.votes))
                );
            }
            println!("  {}", theme::dim(&format!("{} total votes", poll.total_votes)));
        }
    }

    // Replies
    if !data.replies.is_empty() {
        println!();
        println!("{}", theme::separator());
        println!(
            "{}",
            theme::accent_bold(&format!("Replies ({})", data.replies.len()), color)
        );
        println!();

        for reply in &data.replies {
            let r_author = reply
                .author
                .handle
                .as_deref()
                .map(|h| h.to_string())
                .unwrap_or_else(|| theme::dim("anon"));
            let indent = if reply.parent_reply_id.is_some() {
                "    "
            } else {
                "  "
            };
            let prefix = if reply.parent_reply_id.is_some() {
                theme::dim("└ ")
            } else {
                String::new()
            };

            println!(
                "{indent}{prefix}{r_author}  {}  {} {}",
                theme::dim(&time_ago(&reply.created_at)),
                theme::green(&format!("+{}", reply.upvotes)),
                theme::red(&format!("-{}", reply.downvotes))
            );
            let body = if reply.body.len() > 200 {
                format!("{}...", &reply.body[..200])
            } else {
                reply.body.clone()
            };
            println!("{indent}  {body}");
            println!();
        }
    }

    Ok(())
}
