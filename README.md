# Arkora

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![CI](https://github.com/het4rk/arkora/actions/workflows/ci.yml/badge.svg)](https://github.com/het4rk/arkora/actions/workflows/ci.yml)
[![Version](https://img.shields.io/github/v/release/het4rk/arkora?label=version)](https://github.com/het4rk/arkora/releases)

**A provably human anonymous message board. Every voice is verified.**

> Post, vote, and converse anonymously - but every account is backed by a unique World ID proof of humanity. No bots, no fake accounts, no duplicate identities. World ID Orb proofs are validated onchain via the WorldIDRouter contract on World Chain - not on centralized servers.

<p align="center">
  <a href="https://arkora.app"><strong>arkora.app</strong></a> - Try it live in World App
  <br />
  <a href="https://x.com/humansposting">Twitter</a> - <a href="https://github.com/het4rk/arkora/releases">Changelog</a> - <a href="#developer-api">API Docs</a> - <a href="#cli">CLI</a>
</p>


---

## Features

### Feed and Posts

- Infinite-scroll feed with board filtering
- Three feed modes: Curated (hot-ranked), Following, Local (GPS radius)
- 40+ topic boards with fuzzy search and dynamic creation
- Post quotes, reposts, and threaded replies
- Post impressions (view count, deduplicated per verified human)
- Multi-entity search across boards, people, and posts with prefix-first matching
- Bookmarks and native share sheet

### Polls

- Sybil-resistant polls - one verified human, one vote, cryptographically enforced
- Timed (24h / 3d / 7d) or perpetual duration
- Live vote percentages with inline results

### Identity and Privacy

- Three identity modes: Anonymous (fresh tag each post), Alias (persistent derived handle), Named (World ID username)
- Per-action identity: choose anon/alias/named on each post or reply independently
- Social gating: follow, DM, tip, and subscribe require named mode
- Confessions board - force-anonymous, completely unlinkable
- Human Karma and reputation tiers displayed on profiles and feed cards

### Real-time

- Live ephemeral Rooms with Clubhouse-style participant grid and speaking indicators
- End-to-end encrypted DMs (ECDH Curve25519 + AES-256-GCM)
- In-app and native push notifications (replies, mentions, follows, DMs, tips, quotes)
- @ mention autocomplete in composers

### Monetization

- WLD tips with push notification to recipient
- Creator subscriptions
- Skin shop (accent color customization, 1 WLD each, with live preview before purchase)
- Font shop (7 Google Fonts, 1 WLD each, with live preview before purchase)

### Moderation

- Block, report, and auto-hide at 5 reports
- Community Notes fact-checking system
- Comprehensive CSP headers, constant-time nonce comparison, private Pusher channels
- Input sanitization on all user-generated content
- GDPR-compliant account deletion

### Customization

- Light and dark theme
- Responsive layout - adapts from mobile (full width) to desktop (centered column with side borders)
- 10 languages: English, Spanish, Portuguese, French, German, Japanese, Korean, Thai, Indonesian, Turkish (auto-detected, manually overridable)
- Server-synced preferences (theme, notifications, location persist across devices)
- Profile picture upload

### Public API

- REST API for verified-human posts, polls, boards, and stats
- v1: API key authentication with CORS support (read + write)
- v2: AgentKit proof-of-human auth for AI agents + API key fallback
- Premium analytics: sentiment, trends, geographic demographics (AgentKit-only)
- x402 micropayments for premium data (USDC on World Chain)
- MCP server for native AI agent tooling (Claude, GPT, etc.)

### CLI

Two implementations available:

- **Rust CLI** (`cli-rust/`) - 4.5MB native binary, no runtime dependencies. Recommended for end users.
- **Node CLI** (`cli/`) - TypeScript/commander-based, useful for development and prototyping.

Authenticate with World ID directly in your terminal (ASCII banner on launch).

| Command | Description |
| --- | --- |
| `arkora login` | World ID QR code in terminal - scan with World App, logged in instantly |
| `arkora me` | View your profile (syncs accent color to terminal) |
| `arkora feed` | Browse posts with colored output |
| `arkora view <id>` | View a post with replies and poll results |
| `arkora post "Title"` | Create a post (`--body`, `--board` flags) |
| `arkora reply <id>` | Reply to a post (`--body` flag) |
| `arkora vote <id>` | Vote on a post (`--up`, `--down`, `--undo`) |
| `arkora search "query"` | Search posts, boards, and people (`--type` flag) |
| `arkora notifications` | View notifications (`--read` to mark all read) |
| `arkora boards` | List all boards with post counts |
| `arkora stats` | Platform stats |

Your accent color from the Arkora skin shop carries over to the CLI - all headings and highlights use your color.

---

## Changelog

See [Releases](https://github.com/het4rk/arkora/releases) for the full version history and changelog.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 15 (App Router, Turbopack) |
| Language | TypeScript 5.6 (strict mode) |
| Database | Neon Postgres via `@neondatabase/serverless` HTTP driver + Drizzle ORM |
| Auth | SIWE (Sign-In with Ethereum) + World MiniKit + IDKit v4 |
| Real-time | Pusher Channels (private, server-authorized) |
| File storage | Hippius S3 - decentralized storage on Bittensor subnet 14 |
| State | Zustand (with localStorage persistence) |
| Animations | Framer Motion |
| Blockchain | World Chain (chain 480) - proof verified onchain via WorldIDRouter |
| Identity | World ID 4.0 (MiniKit + IDKit, Orb verified) |
| Monitoring | Sentry (error tracking + session replay) + Vercel Analytics |

---

## Quick Start

### Prerequisites

- Node.js 22 (see `.nvmrc`)
- pnpm (`npm i -g pnpm`)
- [Worldcoin Developer Portal](https://developer.worldcoin.org) app
- [Neon](https://neon.tech) Postgres database
- [Pusher](https://pusher.com) Channels app
- [Hippius](https://hippius.com) S3 bucket (or any S3-compatible storage)

### Setup

```bash
pnpm install
cp .env.example .env.local   # fill in your credentials
pnpm db:push                 # push schema to database
pnpm dev                     # start dev server at http://localhost:3000
```

### CLI Install

**From source (requires Rust):**

```bash
cd cli-rust
cargo build --release
cp target/release/arkora /usr/local/bin/   # or ~/bin/
```

**Usage:**

```bash
arkora login                              # scan World ID QR with phone
arkora feed                               # browse posts
arkora post "Hello from CLI" --board arkora
arkora view <post-id>                     # view post + replies
arkora vote <post-id> --up                # upvote
```

See `.env.example` for all required environment variables.

> **World App testing:** To test the full World ID flow you need World App on your phone. Use ngrok or a Vercel preview deployment to expose a public URL, then update your Developer Portal redirect URL to match.

---

## Architecture

### Auth Flow

```text
World App opens miniapp
  -> WalletConnect auto-triggers walletAuth (MiniKit.commands.walletAuth)
  -> User signs SIWE message in World App
  -> POST /api/auth/wallet -> verifies signature, issues httpOnly cookies:
      arkora-nh      (nullifierHash - unique World ID identifier)
      wallet-address (EVM address)
  -> Zustand store hydrates: isVerified=true, nullifierHash, user
```

World ID Orb verification is a separate step. The proof is validated onchain via the WorldIDRouter contract on World Chain (chain 480) - no centralized API. The verification block number is stored and displayed in-app with a link to worldscan.org.

### Identity Modes

| Mode | Description |
| --- | --- |
| **Anonymous** | Fresh `Human #XXXX` tag each post (default, most anonymous, unlinkable) |
| **Alias** | SHA256-derived persistent handle, linkable across posts but not to real identity |
| **Named** | World ID username shown publicly, required for social features (follow, DM, tip) |

### Feed Modes

| Mode | Description |
| --- | --- |
| **Curated** | Global feed, hot-ranked posts (Wilson-score time-decay, server-cached) |
| **Following** | Posts from followed users (requires auth) |
| **Local** | Posts near the viewer's GPS coordinates, filtered by radius |

### DMs

End-to-end encrypted. Key exchange uses ECDH (Curve25519); messages encrypted with AES-256-GCM. Public keys stored server-side. Private keys live only in the client (Zustand / localStorage) - the server never sees them. Block checks enforced server-side. All DM Pusher channels are private (server-authorized).

### Security

Arkora has undergone comprehensive security auditing across all layers. Key properties:

- **No SQL injection** - all queries use Drizzle ORM parameterized builders, no raw SQL string interpolation
- **Auth isolation** - identity comes exclusively from the `arkora-nh` httpOnly cookie via `getCallerNullifier()`, request body is never trusted for identity
- **CSRF mitigated** - `SameSite=Strict` on all auth cookies
- **World ID replay protection** - enforced by the WorldIDRouter contract on World Chain, the EVM reverts on duplicate nullifier submissions
- **Input sanitization** - all user text passes through `sanitizeLine()` / `sanitizeText()` (NFKC normalization + HTML stripping) before DB writes
- **Private Pusher channels** - all per-user channels require server-side authorization
- **CSP hardened** - `unsafe-eval` removed from `script-src`, HSTS 2-year preload, COOP headers set
- **Constant-time nonce comparison** - SIWE nonce validation uses `crypto.timingSafeEqual()`
- **Rate limiting** - async per-endpoint, per-user sliding window on all 64+ routes (Upstash Redis in production, in-memory fallback for dev)
- **Atomic votes** - single CTE statements to prevent race conditions
- **Session recovery** - `authFetch()` wrapper on all client API calls detects expired sessions and forces re-authentication

For vulnerability reporting, see [SECURITY.md](./SECURITY.md).

### Decentralization

Arkora is being progressively decentralized across every layer:

| Layer | Status | Approach |
| --- | --- | --- |
| **Identity** | Live | World ID Orb proofs validated onchain via WorldIDRouter on World Chain |
| **File storage** | Live (beta) | User-uploaded media stored on [Hippius](https://hippius.com) (Bittensor subnet 14, S3-compatible API). Production transition will move to Hippius mainnet with replication guarantees. |
| **Compute** | Planned | Migrate backend to [Chutes](https://chutes.ai) (Bittensor subnet 64) with TEE-attested execution |
| **Database** | Planned | Evaluate decentralized or verifiable data storage options |

The goal: a social platform where proof of humanity, content storage, and application logic are all decentralized - no single operator can censor, surveil, or shut down the network.

#### Compute Migration - Chutes (Subnet 64)

When Arkora transitions out of beta, backend compute will move from centralized Vercel serverless functions to [Chutes](https://chutes.ai) on Bittensor subnet 64. Chutes provides decentralized GPU/CPU compute with Trusted Execution Environment (TEE) attestation, meaning application logic runs inside hardware-isolated enclaves (Intel TDX / AMD SEV-SNP) where neither the node operator nor the host OS can inspect or tamper with the running process.

**Integration plan:**

- **TEE attestation** - Each Chutes compute node generates a cryptographic attestation report signed by the CPU's hardware root of trust. Arkora will verify these attestation chains before routing requests, ensuring every API call is processed inside a genuine TEE enclave. This guarantees that even the compute provider cannot read user data, session tokens, or encryption keys in memory.
- **Containerized deployment** - Arkora's Next.js server and API routes will be packaged as OCI containers deployed to Chutes nodes. The container image hash is included in the TEE attestation, so clients can verify they're talking to the exact published build - no hidden modifications.
- **Decentralized routing** - Requests will be load-balanced across multiple Chutes miners on subnet 64 via the Bittensor incentive mechanism. Miners are scored on latency, uptime, and attestation validity. Poor performers lose stake; reliable nodes earn TAO emissions.
- **Key management** - Database credentials and signing keys will be provisioned inside the TEE via sealed storage (keys encrypted to the enclave's identity). Keys are never exposed to the host filesystem or operator. Rotation happens through re-sealing to new enclave measurements.
- **Verifiable compute chain** - Combined with World ID onchain verification (World Chain) and Hippius decentralized storage (subnet 14), this creates an end-to-end verifiable stack: identity proven onchain, data stored on decentralized storage, and compute executed in attested TEEs - no single trusted party in the critical path.

---

## Developer API

Arkora exposes a public REST API for accessing verified-human posts, polls, and stats. All data originates from World ID-verified accounts.

**Base URL:** `https://arkora.app/api/v1`

**Authentication:** Include your API key in every request:

```http
X-API-Key: ark_<your-key>
```

### Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/v1/posts` | List posts. Params: `boardId`, `type`, `limit` (1-50), `cursor` |
| GET | `/v1/polls` | List polls with live vote counts. Params: `boardId`, `active=true`, `limit`, `cursor` |
| GET | `/v1/boards` | All boards with post counts |
| GET | `/v1/stats` | `totalPosts`, `totalPolls`, `totalVerifiedHumans`, `totalPollVotes` |

All responses follow the format: `{ success: true, data: [...], nextCursor: "..." | null }`

**Getting an API key:** Open Arkora in World App, go to Settings, scroll to "Developer API", and tap "New API key". You must be a World ID-verified user. Keys are prefixed `ark_` and shown once - copy immediately.

### v2 API (AgentKit + Premium Analytics)

**Base URL:** `https://arkora.app/api/v2`

v2 endpoints accept dual authentication:
- **AgentKit** (recommended for AI agents) - `agentkit` header with proof-of-human delegation. Agents get 2x rate limits and access to premium endpoints.
- **API key** fallback - same `X-API-Key` header as v1.

| Method | Path | Description | Auth |
| --- | --- | --- | --- |
| GET | `/v2/posts` | List posts | AgentKit or API key |
| GET | `/v2/polls` | List polls with vote counts | AgentKit or API key |
| GET | `/v2/boards` | All boards with post counts | AgentKit or API key |
| GET | `/v2/stats` | Platform aggregate stats | AgentKit or API key |
| GET | `/v2/sentiment` | Sentiment score per board | AgentKit only |
| GET | `/v2/trends` | Trending topics by velocity | AgentKit only |
| GET | `/v2/demographics` | Geographic vote distribution | AgentKit only |

Premium endpoints (sentiment, trends, demographics) include 50 free requests per day per human. After that, x402 micropayments apply.

### MCP Server

Arkora ships a standalone MCP server so AI agents (Claude, GPT, etc.) can query verified-human data natively.

```bash
cd mcp && pnpm install
ARKORA_API_KEY=ark_... npx tsx index.ts       # stdio transport
ARKORA_API_KEY=ark_... npx tsx index.ts --sse  # SSE on port 3001
```

Available tools: `arkora_search_posts`, `arkora_get_poll_results`, `arkora_get_sentiment`, `arkora_get_trends`, `arkora_get_stats`.

---

## Project Structure

```text
app/
  api/                API routes (auth, posts, replies, votes, dm, rooms, search, ...)
  boards/             Boards list page
  post/[id]/          Thread / post detail
  rooms/              Rooms discovery + room view
  settings/           Settings page
  dm/                 DM inbox + conversation pages
  notifications/      Notifications page
  profile/            User profile page

components/
  auth/               World ID verification, WalletConnect
  compose/            PostComposer, ReplyComposer
  dm/                 ConversationView, ConversationList
  feed/               Feed, ThreadCard, FeedSkeleton
  onboarding/         OnboardingScreen
  rooms/              RoomsDiscovery, RoomView, RoomCard
  search/             SearchSheet (multi-entity search)
  settings/           SettingsView, SkinShop, FontShop
  thread/             ThreadView, ReplyCard, ReplyTree
  ui/                 BottomNav, LeftDrawer, BottomSheet, ...

hooks/                Custom React hooks (mentions, search, feed, tips, ...)

lib/
  db/                 Drizzle schema + per-entity query modules
  crypto/             DM encryption (Curve25519 + AES-256-GCM)
  i18n/               Translation dictionaries (10 locales) + lazy loader
  storage/            Hippius S3 adapter
  rateLimit.ts        Async sliding-window rate limiter (Upstash Redis + in-memory fallback)
  cache.ts            Feed cache with TTL
  sanitize.ts         Input sanitization + mention parsing
  serverAuth.ts       Session cookie reader
  worldid.ts          Onchain World ID proof verification

store/
  useArkoraStore.ts   Global Zustand store

contracts/            ArkoraNullifierRegistry.sol (onchain World ID registry, deployed on World Chain)
cli/                  Node.js CLI (TypeScript + commander)
cli-rust/             Rust CLI (clap + reqwest + colored)
mcp/                  MCP server for AI agent tooling
scripts/              Database seed + migration scripts
docs/                 Social preview image + assets
e2e/                  Playwright E2E tests (5 specs, 11 tests)
proxy.ts              Edge proxy (payload size gating, Next.js 16.2 convention)
vercel.json           Per-route function config (timeouts)
playwright.config.ts  Playwright configuration
public/sw.js          Service worker for PWA offline
```

---

## Testing

```bash
pnpm test              # 82 Vitest unit tests
pnpm test:watch        # watch mode
pnpm test:coverage     # coverage report
pnpm test:e2e          # 11 Playwright E2E tests (chromium)
```

**Unit tests:** 82 Vitest tests covering input sanitization, rate limiting, E2E DM encryption (Curve25519 + AES-256-GCM), karma tiers, AgentKit auth middleware, and utility functions. Tests run in CI before lint and build.

**E2E tests:** 11 Playwright tests across 5 specs (API boards, API posts, API search, feed page, health check). Run against a local dev server in headless Chromium.

See [QA.md](./QA.md) for the full manual testing checklist (80+ test cases across auth, feed, posts, DMs, rooms, monetization, API, and security).

---

## Deployment

1. Push to GitHub and import the repo in the Vercel dashboard.
2. Add all environment variables from `.env.example`.
3. Set `NEXT_PUBLIC_APP_ID` and `APP_ID` to your Worldcoin Developer Portal app ID.
4. Deploy. Update the **Redirect URL** in your Developer Portal to match your production domain.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, branch conventions, and PR requirements.

## Security Policy

To report a vulnerability, see [SECURITY.md](./SECURITY.md). Do not open public issues for security findings.

## License

[MIT](./LICENSE) - Copyright 2026 Arkora (by Hetark). Free to use, fork, and build on.
