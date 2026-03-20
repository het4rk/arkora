use anyhow::Result;
use serde::Deserialize;

use crate::api::ArkoraApi;
use crate::config;
use crate::theme;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SearchResults {
    boards: Vec<BoardResult>,
    people: Vec<PersonResult>,
    posts: Vec<PostResult>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BoardResult {
    id: String,
    label: String,
    post_count: Option<i64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PersonResult {
    pseudo_handle: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PostResult {
    id: String,
    title: String,
    body: Option<String>,
    board_id: String,
    upvotes: i64,
    downvotes: i64,
    author: AuthorResult,
}

#[derive(Deserialize)]
struct AuthorResult {
    handle: Option<String>,
}

pub async fn run(query: &str, filter_type: &str, color: (u8, u8, u8)) -> Result<()> {
    let cfg = config::load();
    let key = config::require_key(&cfg);
    let api = ArkoraApi::new(&config::api_url(&cfg), &key);

    let path = format!(
        "/search?q={}&type={filter_type}",
        urlencoding::encode(query)
    );
    let resp = api.get::<SearchResults>(&path).await?;
    let data = resp.data.unwrap();

    let has_results = !data.boards.is_empty() || !data.people.is_empty() || !data.posts.is_empty();
    if !has_results {
        println!("{}", theme::dim("No results found."));
        return Ok(());
    }

    println!();

    if !data.boards.is_empty() {
        println!("{}", theme::accent_bold("Boards", color));
        for b in &data.boards {
            let count = b
                .post_count
                .map(|c| format!("{c} posts"))
                .unwrap_or_default();
            println!(
                "  {}  {}  {}",
                theme::board(&b.id, color),
                b.label,
                theme::dim(&count)
            );
        }
        println!();
    }

    if !data.people.is_empty() {
        println!("{}", theme::accent_bold("People", color));
        for p in &data.people {
            let name = p.pseudo_handle.as_deref().unwrap_or("anon");
            println!("  {}", theme::accent(name, color));
        }
        println!();
    }

    if !data.posts.is_empty() {
        println!("{}", theme::accent_bold("Posts", color));
        for p in &data.posts {
            let author = p
                .author
                .handle
                .as_deref()
                .map(|h| h.to_string())
                .unwrap_or_else(|| theme::dim("anon"));
            println!("  {}", theme::accent_bold(&p.title, color));
            println!(
                "    {author} in {}  {} {}  {}",
                theme::board(&p.board_id, color),
                theme::green(&format!("+{}", p.upvotes)),
                theme::red(&format!("-{}", p.downvotes)),
                theme::dim(&p.id[..8])
            );
            if let Some(body) = &p.body {
                if !body.is_empty() {
                    let preview = if body.len() > 100 {
                        format!("{}...", &body[..100])
                    } else {
                        body.clone()
                    };
                    println!("    {}", theme::dim(&preview));
                }
            }
            println!();
        }
    }

    Ok(())
}
