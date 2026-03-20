use colored::Colorize;

/// Skin color map matching lib/skins.ts
fn skin_hex(id: &str) -> &str {
    match id {
        "red" => "#EF4444",
        "blue" => "#3B82F6",
        "navy" => "#1E3A8A",
        "indigo" => "#6366F1",
        "purple" => "#A855F7",
        "teal" => "#14B8A6",
        "green" => "#22C55E",
        "amber" => "#F59E0B",
        "rose" => "#F43F5E",
        _ => "#FFFFFF",
    }
}

fn parse_hex(hex: &str) -> (u8, u8, u8) {
    let hex = hex.trim_start_matches('#');
    let r = u8::from_str_radix(&hex[0..2], 16).unwrap_or(255);
    let g = u8::from_str_radix(&hex[2..4], 16).unwrap_or(255);
    let b = u8::from_str_radix(&hex[4..6], 16).unwrap_or(255);
    (r, g, b)
}

pub fn get_accent(skin_id: &str, custom_hex: Option<&str>) -> (u8, u8, u8) {
    if skin_id == "hex" {
        if let Some(hex) = custom_hex {
            return parse_hex(hex);
        }
    }
    parse_hex(skin_hex(skin_id))
}

pub fn accent(text: &str, color: (u8, u8, u8)) -> String {
    text.truecolor(color.0, color.1, color.2).to_string()
}

pub fn accent_bold(text: &str, color: (u8, u8, u8)) -> String {
    text.truecolor(color.0, color.1, color.2).bold().to_string()
}

pub fn dim(text: &str) -> String {
    text.dimmed().to_string()
}

pub fn green(text: &str) -> String {
    text.green().to_string()
}

pub fn red(text: &str) -> String {
    text.red().to_string()
}

pub fn board(name: &str, color: (u8, u8, u8)) -> String {
    format!("#{}", name).truecolor(color.0, color.1, color.2).to_string()
}

pub fn separator() -> String {
    "─".repeat(60).dimmed().to_string()
}
