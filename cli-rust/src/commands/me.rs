use anyhow::Result;
use serde::Deserialize;

use crate::api::ArkoraApi;
use crate::config;
use crate::theme;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MeData {
    pseudo_handle: Option<String>,
    identity_mode: String,
    karma_score: i64,
    active_skin_id: Option<String>,
    custom_hex: Option<String>,
    created_at: String,
}

pub async fn run(_color: (u8, u8, u8)) -> Result<()> {
    let cfg = config::load();
    let key = config::require_key(&cfg);
    let api = ArkoraApi::new(&config::api_url(&cfg), &key);

    let resp = api.get::<MeData>("/me").await?;
    let user = resp.data.unwrap();

    // Save skin to config for future sessions
    let mut cfg = config::load();
    cfg.skin_id = user.active_skin_id.clone();
    cfg.custom_hex = user.custom_hex.clone();
    config::save(&cfg)?;

    let skin = user.active_skin_id.as_deref().unwrap_or("monochrome");
    let color = theme::get_accent(skin, user.custom_hex.as_deref());

    let name = user
        .pseudo_handle
        .as_deref()
        .unwrap_or("(no handle set)");
    let joined = &user.created_at[..10]; // just the date

    println!();
    println!("{}", theme::accent_bold(name, color));
    println!();
    println!("  Identity:  {}", theme::accent(&user.identity_mode, color));
    println!("  Verified:  {}", theme::green("Yes"));
    println!(
        "  Karma:     {}",
        theme::accent(&user.karma_score.to_string(), color)
    );
    println!("  Skin:      {}", theme::accent(skin, color));
    println!("  Joined:    {}", theme::dim(joined));
    println!();

    Ok(())
}
