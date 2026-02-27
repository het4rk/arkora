# Arkora

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![CI](https://github.com/het4rk/arkora/actions/workflows/ci.yml/badge.svg)](https://github.com/het4rk/arkora/actions/workflows/ci.yml)

**Open source.** MIT licensed. Contributions welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md).

**Twitter:** [@humansposting](https://x.com/humansposting)

A provably human anonymous message board. Every voice is verified.

Arkora is a World App miniapp where users post, vote, and converse anonymously — but every account is backed by a unique World ID proof of humanity. No bots, no fake accounts, no duplicate identities. TikTok-style scroll feed, 4chan anonymity, Reddit boards structure — every voice cryptographically guaranteed real.

World ID Orb proofs are validated directly on World Chain via the WorldIDRouter smart contract — not on Worldcoin's centralized servers. Proof validation is settled by blockchain consensus.

**Features:** Posts + threaded replies · Sybil-resistant polls (1 verified human = 1 vote) · Human Karma & reputation tiers (shown in feed cards + profiles) · Confessions board (anonymous + verified) · Upvotes / downvotes · Vote reactions (see who liked/disliked) · Repost + quote-repost · In-app notifications (likes, quotes, reposts, replies, follows, DMs, tips) · Community Notes · Bookmarks · Dynamic boards (synonym dedup, typo-tolerant matching) · Following feed · Local feed (GPS radius) · E2E encrypted DMs (with block enforcement) · @ mentions · Live ephemeral Rooms (auto-close when last person leaves) · Block / report / moderation (auto-hide at 5 reports) · WLD tips (with push notification to recipient) & subscriptions · Private Pusher channels (server-authorized) · Light + dark theme · GDPR-compliant account deletion (comprehensive data cleanup) · Privacy Policy + Terms of Service

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, Turbopack) |
| Database | Neon Postgres + Drizzle ORM |
| Auth | SIWE (Sign-In with Ethereum) + World MiniKit + IDKit |
| Real-time | Pusher Channels |
| File storage | Hippius S3 — decentralized storage on Bittensor subnet 14 |
| State | Zustand (with localStorage persistence) |
| Animations | Framer Motion |
| Blockchain | World Chain (chain 480) — proof verified onchain via WorldIDRouter, not Worldcoin's cloud API |
| Identity | Worldcoin World ID 4.0 (MiniKit + IDKit, Orb verified) |
| Monitoring | Sentry (error tracking + session replay) + Vercel Analytics |

---

## Prerequisites

- Node.js 22 (see `.nvmrc`)
- pnpm (`npm i -g pnpm`)
- A [Worldcoin Developer Portal](https://developer.worldcoin.org) app (for World ID)
- A [Neon](https://neon.tech) Postgres database
- A [Pusher](https://pusher.com) Channels app (Sandbox tier works)
- A [Hippius](https://hippius.com) S3 bucket (or any S3-compatible storage)

---

## Local Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

Create `.env.local` in the project root:

```env
# World ID / MiniKit
NEXT_PUBLIC_APP_ID=app_xxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_ACTION_ID=verifyhuman
APP_ID=app_xxxxxxxxxxxxxxxxxxxxxxxx

# World Chain RPC
NEXT_PUBLIC_CHAIN_ID=480
NEXT_PUBLIC_WC_RPC=https://worldchain-mainnet.g.alchemy.com/public

# Database (Neon Postgres)
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# Pusher
PUSHER_APP_ID=your-pusher-app-id
PUSHER_KEY=your-pusher-key
PUSHER_SECRET=your-pusher-secret
PUSHER_CLUSTER=us2
NEXT_PUBLIC_PUSHER_KEY=your-pusher-key
NEXT_PUBLIC_PUSHER_CLUSTER=us2

# Hippius S3 (decentralized file storage)
HIPPIUS_ACCESS_KEY_ID=your-access-key
HIPPIUS_SECRET_ACCESS_KEY=your-secret-key
HIPPIUS_BUCKET=arkora-uploads
HIPPIUS_S3_ENDPOINT=https://s3.hippius.com
HIPPIUS_PUBLIC_URL=https://s3.hippius.com

# Admin metrics (comma-separated nullifier hashes that can access /api/admin/metrics)
ADMIN_NULLIFIER_HASHES=0xabc123...

# World Chain (onchain proof verification)
WORLD_ID_ROUTER=0x17B354dD2595411ff79041f930e491A4Df39A278
WORLD_CHAIN_RPC=https://worldchain-mainnet.g.alchemy.com/public

# Sentry (optional — required for production source map uploads and error tracking)
SENTRY_AUTH_TOKEN=your-sentry-auth-token
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
```

### 3. Push the database schema

```bash
pnpm db:push
```

### 4. (Optional) Seed sample data

```bash
pnpm db:seed
```

### 5. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

> **World App testing**: To test the full World ID flow you need World App on your phone. Use ngrok or Vercel Preview to expose a public URL, then update your Developer Portal redirect URL to match.

---

## Deployment (Vercel)

1. Push to GitHub and import the repo in the Vercel dashboard.
2. Add all environment variables from the table above.
3. Set `NEXT_PUBLIC_APP_ID` and `APP_ID` to your Worldcoin Developer Portal app ID.
4. Deploy.

**Developer Portal**: After deploying, update the **Redirect URL** in your Worldcoin Developer Portal to `https://your-domain.vercel.app`.

---

## Architecture

### Auth Flow

```
World App opens miniapp
  → WalletConnect auto-triggers walletAuth (MiniKit.commands.walletAuth)
  → User signs SIWE message in World App
  → POST /api/auth/wallet → verifies signature, issues httpOnly cookies:
      arkora-nh      (nullifierHash — the user's unique World ID identifier)
      wallet-address (EVM address)
  → Zustand store hydrates: isVerified=true, nullifierHash, user
```

World ID proof (Orb verification) is a separate step triggered by the user tapping "Verify & join" on the onboarding screen or "Verify with World ID" in the drawer. The proof is validated onchain via the WorldIDRouter contract on World Chain (no centralized API). The verification block number is stored and displayed in-app on profiles and in settings, with a link to worldscan.org.

### Identity Modes

Users choose how to appear:

| Mode | Description |
|---|---|
| **Random** | Fresh `Human #XXXX` tag each post (default, most anonymous) |
| **Alias** | Consistent user-chosen handle, persisted locally |
| **Named** | World ID username shown publicly |

### Feed Modes

| Mode | Description |
|---|---|
| **Curated** | Global feed, highest-ranked posts (server-cached, 30s TTL) |
| **Following** | Posts from followed users (requires auth) |
| **Local** | Posts near the viewer's GPS coordinates, filtered by radius |

### DMs

End-to-end encrypted. Key exchange uses ECDH (Curve25519); messages encrypted with AES-256-GCM. Public keys stored server-side. Private keys live only in Zustand / localStorage — the server never sees them. Block checks enforced server-side — blocked users cannot send or receive DMs. All DM Pusher channels are private (server-authorized).

### Security

Arkora underwent a comprehensive security audit (Sprint 19) across all layers — SQL injection, auth bypass, XSS/CSRF, rate limiting, secrets, headers, and infrastructure. Key properties:

- **No SQL injection**: All queries use Drizzle ORM parameterized builders — no raw SQL string interpolation anywhere in the codebase
- **Auth isolation**: Identity comes exclusively from the `arkora-nh` httpOnly cookie via `getCallerNullifier()`. Request body is never trusted for identity
- **CSRF mitigated**: `SameSite=Strict` on all auth cookies. No additional CSRF token layer required
- **World ID replay protection**: Enforced by the WorldIDRouter contract on World Chain — the EVM reverts on duplicate nullifier submissions
- **Input sanitization**: All user text passes through `sanitizeLine()` / `sanitizeText()` (NFKC normalization + HTML stripping) before DB writes
- **Private Pusher channels**: All per-user channels (`private-user-*`) require server-side authorization — prevents metadata snooping
- **CSP**: `unsafe-eval` removed from `script-src`. HSTS 2-year preload. COOP + X-Permitted-Cross-Domain-Policies headers set
- **Constant-time nonce comparison**: SIWE nonce validation uses `crypto.timingSafeEqual()` to prevent timing oracle attacks
- **Rate limiting**: Per-endpoint, per-user sliding window. In-memory (per Vercel instance) — sufficient for early scale
- **Error messages**: World ID verification errors return generic messages to client; detailed errors logged server-side only
- **Atomic votes**: Vote operations use single CTE statements to prevent race conditions

For vulnerability reporting, see [SECURITY.md](./SECURITY.md).

### Rate Limiting

In-memory sliding-window rate limiter (`lib/rateLimit.ts`). Per-Vercel-instance (sufficient for early scale). Key limits:
- Feed (`GET /posts`): 60 req/min per IP
- Post creation: 5 posts/min per user
- Replies, votes, search: similar per-user limits

### Decentralization

Arkora is being progressively decentralized across every layer of the stack:

| Layer | Status | Approach |
|---|---|---|
| **Identity** | Live | World ID Orb proofs validated onchain via WorldIDRouter on World Chain — no centralized identity API |
| **File storage** | Live | User-uploaded media stored on [Hippius](https://hippius.com), a decentralized S3-compatible service built on Bittensor subnet 14 |
| **Compute / platform** | Planned | Migrate core platform logic (feed, posts, moderation) to Bittensor subnet infrastructure — replacing centralized Vercel serverless functions with incentivized, decentralized compute |
| **Database** | Planned | Evaluate decentralized or verifiable data storage options as the platform matures |

The goal: a social platform where proof of humanity (World ID), content storage (Bittensor/Hippius), and application logic are all decentralized — no single operator can censor, surveil, or shut down the network.

> This is a work in progress. Contributions and ideas welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## Boards

| ID | Label | Emoji |
|---|---|---|
| `arkora` | Arkora | 🏛️ |
| `technology` | Technology | ⚡ |
| `markets` | Markets | 📈 |
| `politics` | Politics | 🗳️ |
| `worldchain` | World Chain | 🌐 |

---

## Key Directories

```
app/
  api/                API routes (auth, posts, replies, votes, dm, rooms, search, …)
  boards/             Boards list page
  post/[id]/          Thread / post detail
  rooms/              Rooms discovery + room view pages
  settings/           Settings page
  dm/                 DM inbox + conversation pages
  notifications/      Notifications page
  profile/            User profile page

components/
  auth/               VerifyHuman verification sheet, WalletConnect
  compose/            PostComposer, ReplyComposer
  dm/                 ConversationView, ConversationList
  feed/               Feed, ThreadCard, FeedSkeleton
  onboarding/         OnboardingScreen (first-run slides)
  rooms/              RoomsDiscovery, RoomView, RoomCard, RoomComposer, …
  settings/           SettingsView
  thread/             ThreadView, ReplyCard, ReplyTree
  ui/                 BottomNav, LeftDrawer, BodyText, MentionSuggestions, …

hooks/
  useMentionAutocomplete.ts   @mention detection + debounced autocomplete

lib/
  db/                 Drizzle schema + per-entity query modules (posts, replies, rooms, …)
  crypto/             DM encryption (Curve25519 + AES-256-GCM)
  storage/            Hippius S3 adapter
  rateLimit.ts        In-memory sliding-window rate limiter
  cache.ts            In-memory feed cache (30s TTL)
  sanitize.ts         Input sanitization + parseMentions()
  serverAuth.ts       Read caller nullifierHash from session cookie

store/
  useArkoraStore.ts   Global Zustand store (auth, UI, preferences, activeRoomId)
```

---

## Infrastructure (20 users day one)

| Service | Free limit | Status |
|---|---|---|
| Vercel Hobby | 100 GB-hours/month | Comfortable |
| Neon Free | 20 connections, 3 GB | OK — batch queries in hot paths |
| Pusher Sandbox | 100 connections, 200k msg/day | Fine |
| Hippius S3 | Pay-per-use | Minimal cost at launch |

---

## Sprint History

| Sprint | Shipped |
| ------ | ------- |
| 20 | Unit test suite (69 tests — sanitize, rateLimit, crypto/dm, karma, utils), signout cookie hardening, Bittensor/decentralization docs |
| 19 | Comprehensive security audit (10 patches), Sentry error tracking, CI upgrade (Node 22), GitHub community files |
| 18 | Production hardening: auth bypass fix, atomic votes, private Pusher channels, CSP hardening, account deletion cleanup |
| 17 | UX polish: TipModal, ConversationView error states, PostComposer improvements, URL validation |
| 16 | Tip push notifications, rooms auto-close, karma score in feed cards |
| 15 | Dynamic board system (synonym dedup + Levenshtein), PostComposer UX overhaul |
| 14 | ArkoraNullifierRegistry.sol, post content hashes (tamper evidence) |
| 13 | Onchain World ID verification via WorldIDRouter (World Chain), verifiedBlockNumber |
| 12 | Health check, CI pipeline, OG metadata, auth rate limiting, account deletion, legal pages |
| 10–11 | Rooms Phase 1, sign-out persistence, vote reactions, repost, report auto-hide |
| 7–9 | Sybil-resistant polls, Karma/reputation, Confessions board |

---

## Testing

```bash
pnpm test              # run all tests
pnpm test:watch        # watch mode
pnpm test:coverage     # coverage report
```

69 unit tests covering the pure utility layer: input sanitization, rate limiting, E2E DM encryption (Curve25519 + AES-256-GCM), karma tiers, and utility functions. Tests run in CI before lint and build.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, branch conventions, and PR requirements.

## Security Policy

To report a vulnerability, see [SECURITY.md](./SECURITY.md). Do not open public issues for security findings.

---

## License

[MIT](./LICENSE) — Copyright © 2026 Arkora (by Hetark). Free to use, fork, and build on.
