# Arkora

A provably human anonymous message board. Every voice is verified.

Arkora is a World App miniapp where users post, vote, and converse anonymously — but every account is backed by a unique World ID proof of humanity. No bots, no fake accounts, no duplicate identities. TikTok-style scroll feed, 4chan anonymity, Reddit boards structure — every voice cryptographically guaranteed real.

**Features:** Posts + threaded replies · Sybil-resistant polls (1 verified human = 1 vote) · Human Karma & reputation tiers · Confessions board (anonymous + verified) · Upvotes / downvotes · Vote reactions (see who liked/disliked) · Repost + quote-repost · In-app notifications (likes, quotes, reposts, replies, follows, DMs) · Community Notes · Bookmarks · Boards · Following feed · Local feed (GPS radius) · E2E encrypted DMs · @ mentions · Live ephemeral Rooms · Block / report / moderation (auto-hide at 5 reports) · WLD tips & subscriptions · Light + dark theme

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, Turbopack) |
| Database | Neon Postgres + Drizzle ORM |
| Auth | SIWE (Sign-In with Ethereum) + NextAuth + World MiniKit |
| Real-time | Pusher Channels |
| File storage | Hippius S3 (decentralized, S3-compatible) |
| State | Zustand (with localStorage persistence) |
| Animations | Framer Motion |
| Blockchain | World Chain (viem) |
| Identity | Worldcoin World ID (MiniKit) |

---

## Prerequisites

- Node.js 20+
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

# NextAuth
NEXTAUTH_SECRET=your-32-char-random-secret
NEXTAUTH_URL=http://localhost:3000

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
3. Set `NEXTAUTH_URL` to your production domain, e.g. `https://arkora.vercel.app`.
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

World ID proof (Orb verification) is a separate step triggered by the user
tapping "Verify & join" on the onboarding screen or "Verify with World ID" in the drawer.

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

End-to-end encrypted. Key exchange uses ECDH (Curve25519); messages encrypted with AES-256-GCM. Public keys stored server-side. Private keys live only in Zustand / localStorage — the server never sees them.

### Rate Limiting

In-memory sliding-window rate limiter (`lib/rateLimit.ts`). Per-Vercel-instance (sufficient for early scale). Key limits:
- Feed (`GET /posts`): 60 req/min per IP
- Post creation: 5 posts/min per user
- Replies, votes, search: similar per-user limits

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

## License

MIT
