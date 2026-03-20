mod api;
mod commands;
mod config;
mod theme;

use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "arkora", version = "2.0.0")]
#[command(about = "CLI for Arkora - the provably human message board")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Verify with World ID and authenticate
    Login,
    /// Show your profile
    Me,
    /// Browse recent posts
    Feed {
        /// Filter by board slug
        #[arg(short, long)]
        board: Option<String>,
        /// Number of posts (1-50)
        #[arg(short, long, default_value = "20")]
        limit: u32,
    },
    /// View a post with replies
    View {
        /// Post ID
        id: String,
    },
    /// Create a new post
    Post {
        /// Post title
        title: String,
        /// Post body text
        #[arg(long)]
        body: Option<String>,
        /// Board to post in
        #[arg(short, long, default_value = "arkora")]
        board: String,
    },
    /// Reply to a post
    Reply {
        /// Post ID to reply to
        post_id: String,
        /// Reply text
        #[arg(long)]
        body: String,
    },
    /// Vote on a post
    Vote {
        /// Post ID
        post_id: String,
        /// Upvote
        #[arg(short, long)]
        up: bool,
        /// Downvote
        #[arg(short, long)]
        down: bool,
        /// Remove vote
        #[arg(long)]
        undo: bool,
    },
    /// Search posts, boards, and people
    Search {
        /// Search query
        query: String,
        /// Filter: all, posts, boards, people
        #[arg(short = 't', long = "type", default_value = "all")]
        filter_type: String,
    },
    /// View notifications
    #[command(alias = "notifs")]
    Notifications {
        /// Mark all as read
        #[arg(short, long)]
        read: bool,
    },
    /// List all boards
    Boards,
    /// Platform stats
    Stats,
}

fn load_color() -> (u8, u8, u8) {
    let cfg = config::load();
    let skin = cfg.skin_id.as_deref().unwrap_or("monochrome");
    theme::get_accent(skin, cfg.custom_hex.as_deref())
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();
    let color = load_color();

    let result = match cli.command {
        Commands::Login => commands::login::run(color).await,
        Commands::Me => commands::me::run(color).await,
        Commands::Feed { board, limit } => commands::feed::run(board, limit, color).await,
        Commands::View { id } => commands::view::run(&id, color).await,
        Commands::Post { title, body, board } => {
            commands::post::run(&title, body.as_deref(), &board, color).await
        }
        Commands::Reply { post_id, body } => {
            commands::reply::run(&post_id, &body, color).await
        }
        Commands::Vote {
            post_id,
            up,
            down,
            undo,
        } => commands::vote::run(&post_id, up, down, undo).await,
        Commands::Search {
            query,
            filter_type,
        } => commands::search::run(&query, &filter_type, color).await,
        Commands::Notifications { read } => commands::notifications::run(read, color).await,
        Commands::Boards => commands::boards::run(color).await,
        Commands::Stats => commands::stats::run(color).await,
    };

    if let Err(e) = result {
        eprintln!("\x1b[31m{e}\x1b[0m");
        std::process::exit(1);
    }
}
