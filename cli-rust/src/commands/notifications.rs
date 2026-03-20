use anyhow::Result;
use serde::Deserialize;

use crate::api::ArkoraApi;
use crate::config;
use crate::theme;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct NotifData {
    notifications: Vec<Notification>,
    unread_count: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Notification {
    #[serde(rename = "type")]
    notif_type: String,
    reference_id: Option<String>,
    actor_display: Option<String>,
    read: bool,
    created_at: String,
}

fn type_label(t: &str) -> &str {
    match t {
        "reply" => "replied to your post",
        "mention" => "mentioned you",
        "follow" => "followed you",
        "like" => "upvoted your post",
        "dm" => "sent you a message",
        "quote" => "quoted your post",
        "repost" => "reposted your post",
        _ => t,
    }
}

pub async fn run(mark_read: bool, color: (u8, u8, u8)) -> Result<()> {
    let cfg = config::load();
    let key = config::require_key(&cfg);
    let api = ArkoraApi::new(&config::api_url(&cfg), &key);

    if mark_read {
        api.post::<serde_json::Value>("/notifications", &serde_json::json!({}))
            .await?;
        println!("{}", theme::dim("All notifications marked as read."));
        return Ok(());
    }

    let resp = api.get::<NotifData>("/notifications").await?;
    let data = resp.data.ok_or_else(|| anyhow::anyhow!("No data in response"))?;

    println!();
    if data.unread_count > 0 {
        println!(
            "{}",
            theme::accent_bold(&format!("{} unread", data.unread_count), color)
        );
    }

    if data.notifications.is_empty() {
        println!("{}", theme::dim("No notifications."));
        println!();
        return Ok(());
    }

    println!();
    for n in &data.notifications {
        let actor = n
            .actor_display
            .as_deref()
            .map(|a| theme::accent(a, color))
            .unwrap_or_else(|| theme::dim("Someone"));
        let action = type_label(&n.notif_type);
        let unread = if n.read { "" } else { " *" };
        let reference = n
            .reference_id
            .as_deref()
            .map(|r| format!(" ({}...)", &r[..r.len().min(8)]))
            .unwrap_or_default();
        let time = n.created_at.get(..10).unwrap_or(&n.created_at);

        println!(
            "  {actor} {action}{ref_dim}{unread_mark}  {time_dim}",
            ref_dim = theme::dim(&reference),
            unread_mark = if unread.is_empty() {
                String::new()
            } else {
                " *".to_string()
            },
            time_dim = theme::dim(time)
        );
    }
    println!();
    println!("{}", theme::dim("Use --read to mark all as read"));
    println!();

    Ok(())
}
