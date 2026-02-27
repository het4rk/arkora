# CLAUDE.md — Arkora Project Context

This file is loaded automatically by Claude Code at the start of every session. It provides project history, architecture notes, conventions, and next steps.

**Live URL:** https://arkora.vercel.app
**Twitter:** [@humansposting](https://x.com/humansposting)
**World App Developer Portal:** https://developer.worldcoin.org

---

## Commands

```bash
pnpm dev              # Next.js dev server (Turbopack)
pnpm build            # Production build
pnpm lint             # ESLint
pnpm db:push          # Push Drizzle schema to database
pnpm db:generate      # Generate Drizzle migrations
pnpm db:studio        # Open Drizzle Studio GUI
pnpm db:seed          # Seed database (reads .env.local)
```

---

## Tech Stack

- **Framework**: Next.js 15 App Router + Turbopack
- **Language**: TypeScript 5.6 strict mode (`noUncheckedIndexedAccess`, `noImplicitAny`, `noImplicitReturns`)
- **Styling**: Tailwind CSS 3 + custom glass-morphism classes in `globals.css`
- **State**: Zustand with localStorage persistence (`store/useArkoraStore.ts`)
- **Database**: Neon Postgres via Drizzle ORM (`lib/db/schema.ts`)
- **Real-time**: Pusher (server `lib/pusher.ts`, client `pusher-js`)
- **Auth**: World ID MiniKit (`@worldcoin/minikit-js`, `@worldcoin/minikit-react`) + IDKit (`@worldcoin/idkit`) for desktop
- **Blockchain**: viem on World Chain (WorldIDRouter onchain proof verification, chain 480)
- **Crypto**: `@noble/curves` (Curve25519 ECDH), `@noble/hashes` (HKDF-SHA256), Web Crypto (AES-256-GCM)
- **File storage**: Hippius S3 (`lib/storage/hippius.ts`, S3-compatible)
- **Animations**: Framer Motion

---

## What's Been Built (Shipped Features)

### Onchain World ID Verification (Sprint 13)

- [x] `lib/worldid.ts` — rewrote from `verifyCloudProof` (Worldcoin cloud API) to viem `readContract` against WorldIDRouter on World Chain mainnet (chain 480)
- [x] WorldIDRouter address: `0x17B354dD2595411ff79041f930e491A4Df39A278` (World Chain mainnet)
- [x] `hashToField(hex) = BigInt(keccak256(hex)) >> 8n` — matches IDKit-core v2.1.0 exactly
- [x] `computeExternalNullifierHash(appId, action)` — double hashToField matching World App ZK proof computation
- [x] `getLatestWorldChainBlock()` helper — records block number at time of verification
- [x] `verifiedBlockNumber` bigint column added to `humanUsers` — populated on new verifications
- [x] Profile + Settings show "Verified on World Chain · block #N" with Worldscan link
- [x] Public profiles show "Verified on World Chain" badge linked to worldscan.org/address/{wallet}
- [x] `WORLD_ID_ROUTER` and `WORLD_CHAIN_RPC` added to required env vars and `.env.example`
- [x] TypeScript target bumped ES2017 → ES2020 for BigInt literal support
- [x] Developer Portal Engine changed to "Onchain" (no longer "Cloud")
- [x] Identity merge fix: `/api/profile` fetches posts/replies for both World ID + wlt_ linked identities
- [x] `GET /api/auth/user` added for ProfileView to refresh stale store data on mount
- [x] WalletConnect bio migration extended — copies bio from World ID record to wlt_ record

### Security Audit + Hardening (Sprint 19)

- [x] **Comprehensive audit** — 4 agents across all layers: SQL injection, auth bypass, XSS/CSRF, rate limiting, secrets, headers, infra
- [x] **Poll sanitize order** — `sanitizeLine()` now called BEFORE length check (NFKC normalization can change string length)
- [x] **Lat/lng bounds** — feed GET and POST body both enforce `-90≤lat≤90`, `-180≤lng≤180`, `0<radiusMiles≤5000`
- [x] **EVM address regex** — `/api/verify` validates `walletAddress` with `/^0x[0-9a-fA-F]{40}$/` before proof verification
- [x] **Rate limit keys** — all authenticated endpoints use `nullifierHash` (not IP); auth/user POST uses full wallet address
- [x] **Sentry PII** — `sendDefaultPii: false` (was `true`), `tracesSampleRate: 0.1`, `replaysOnErrorSampleRate: 0.5`; DSN is semi-public by design
- [x] **Nonce constant-time** — `/api/auth/route.ts` uses `crypto.timingSafeEqual()` + format validation `/^[0-9a-f]{32}$/`
- [x] **Security headers** — `Cross-Origin-Opener-Policy: same-origin` + `X-Permitted-Cross-Domain-Policies: none` added to `next.config.ts`
- [x] **Bookmarks bulk limit** — `slice(0, 50)` → `slice(0, 10)` (feed pages load ≤10 posts)
- [x] **Feed numeric parsing** — strict `/^\d+$/` regex + `Math.min(parseInt, 50)` cap for `limit` param
- [x] **DM conversations rate limit** — key changed from IP to `nullifierHash` (authenticated endpoint)
- [x] **Nonce cookie** — `secure: true` always (was `process.env.NODE_ENV === 'production'`)
- [x] **Sentry integrated** — `instrumentation-client.ts`, `global-error.tsx`, `SENTRY_AUTH_TOKEN` in Vercel
- [x] **pnpm audit** — patched all 3 vulnerabilities via pnpm overrides: `minimatch >=10.2.3` (2 HIGH ReDoS in eslint chain), `fast-xml-parser >=5.3.8` (1 LOW in AWS SDK); `pnpm audit` now returns zero vulnerabilities
- [x] **CI** — upgraded Node 20 → 22, added `SENTRY_AUTH_TOKEN` + `NEXT_PUBLIC_WORLD_APP_ID` to build env
- [x] **GitHub community** — `SECURITY.md`, `CONTRIBUTING.md`, PR template, bug/feature issue templates, `CODEOWNERS`

### Production Hardening Audit (Sprint 18)

- [x] **Auth bypass fix** — `POST /api/auth/user` now verifies `wallet-address` cookie matches body `walletAddress` (prevents session hijack via forged body params)
- [x] **worldIdVerified schema default** — changed from `true` to `false` (new users no longer auto-pass verification gate)
- [x] **validateEnv() wired up** — called on DB module import (`lib/db/index.ts`), fails fast with clear error if any required env var is missing; `APP_ID` added to required vars
- [x] **Atomic vote operations** — `deletePostVote`, `deleteReplyVote`, `deleteNoteVote` converted from two-statement DELETE+UPDATE to single CTE statements (eliminates race conditions on concurrent unvotes)
- [x] **Hard delete cleanup** — renamed `softDeletePost` → `deletePost`, `softDeleteReply` → `deleteReply`; removed 40+ dead `isNull(deletedAt)` filters across 7 files; removed `deletedAt` from `Post`/`Reply` TypeScript interfaces and all `toPost()`/`toReply()` mapper functions
- [x] **Block check on DMs** — `POST /api/dm/messages` checks bidirectional block status before allowing send; returns 403 if either party has blocked the other
- [x] **Private Pusher channels** — DM + notification channels switched from public `user-${hash}` to `private-user-${hash}` with server-side auth in `/api/pusher/auth`; prevents metadata snooping
- [x] **CSP hardened** — removed `unsafe-eval` from `script-src` in Content-Security-Policy
- [x] **DM keys endpoint secured** — `GET /api/dm/keys` now requires auth + rate limiting (was unauthenticated)
- [x] **Search limit cap** — `searchPosts()` caps `limit` at 50 (prevents abuse via large limit param)
- [x] **markAllRead optimized** — only updates rows where `read = false` (was updating all notifications including already-read)
- [x] **Account deletion comprehensive** — `DELETE /api/user` now cleans dmKeys, dmMessages, notifications, blocks, follows, bookmarks, postVotes, replyVotes, communityNoteVotes, pollVotes, roomParticipants before deleting user row (was leaving orphaned data in 11+ tables)
- [x] **Dead code removed** — deleted `lib/chain.ts` (unused testnet config), `lib/storage/local.ts` (never imported)
- [x] **DB connection pool** — reduced `max` from 10 to 5, singleton client cached in both dev and production (Neon free tier: 20 connections max)
- [x] **World ID error leak** — `lib/worldid.ts` returns generic "Proof verification failed" to client, logs detailed error server-side only
- [x] **toPost() type cast** — fixed repost type from `'text' | 'poll'` to `'text' | 'poll' | 'repost'` in follows.ts, bookmarks.ts, search.ts

### Confessions Board (Sprint 9)
- [x] `'confessions'` added to `BoardId` type + `BOARDS` array (emoji 🤫)
- [x] `ANONYMOUS_BOARDS` set in `lib/types.ts` — boards where posts are force-anonymous server-side
- [x] `POST /api/posts` strips `pseudoHandle` for any `ANONYMOUS_BOARDS` board (server-enforced)
- [x] PostComposer shows anonymity notice when `confessions` board is selected
- [x] Boards page shows "Anonymous + verified human — completely unlinkable" description
- [x] All existing post/feed/search/vote logic unchanged — confessions posts just have `pseudoHandle=null`

### Reputation / Karma (Sprint 8)
- [x] `karmaScore INTEGER` column on `humanUsers` — updated incrementally on every post/reply vote
- [x] Karma tiers: Newcomer (0–9) / Contributor (10–99) / Trusted (100–499) / Elder (500+)
- [x] `lib/db/karma.ts` — `updateKarma()`, `recomputeKarma()`, `getKarmaScore()`, `getKarmaTier()`, `KARMA_TIERS`
- [x] Vote routes (`/api/vote`, `/api/replies/vote`) compute karma delta from old→new direction and fire-and-forget `updateKarma()`
- [x] `KarmaBadge` component — renders colored tier pill; no badge for Newcomers (keeps UI clean)
- [x] KarmaBadge shown in ThreadView (post detail) next to HumanBadge
- [x] KarmaBadge + score shown on own profile (ProfileView) + public profile (PublicProfileView)
- [x] `GET /api/posts/[id]` returns `authorKarmaScore` for the ThreadView to display

### Polls (Sprint 7 — Sybil-Resistant)
- [x] Poll type on posts — question + 2–4 options + duration (24h / 3d / 7d)
- [x] DB: `type`, `pollOptions` (JSONB), `pollEndsAt` columns on `posts`; new `pollVotes` table with `UNIQUE(postId, nullifierHash)` — one verified human, one vote, cryptographically enforced
- [x] `POST /api/polls/[id]/vote` — casts vote, returns updated results
- [x] `GET /api/posts/[id]` extended — returns `pollResults` + `userVote` for poll posts
- [x] PostComposer: Post / Poll mode toggle (two pills). Poll mode shows `PollOptionInputs` + duration selector
- [x] `PollCard.tsx` — clickable option buttons → live % bars with your checkmark
- [x] Feed and ThreadView both render polls inline

### Core
- [x] Snap-scroll vertical feed (TikTok-style) with cards
- [x] 5 topic boards (arkora, technology, markets, politics, worldchain)
- [x] Post creation with title, body, optional image upload (Hippius S3)
- [x] Post quotes (embed another post inline)
- [x] Threaded replies with nested voting + sort (top/new)
- [x] Upvote / downvote (optimistic UI, self-vote blocked)
- [x] Community Notes (fact-checking system)
- [x] Bookmarks
- [x] Full-text search (posts + boards) — crash-fixed
- [x] User profiles with avatar, bio, identity mode
- [x] Follow / unfollow users
- [x] Following feed tab

### Location
- [x] Local feed tab — GPS-filtered posts by radius (1 mi → Country)
- [x] Optional location tagging on posts
- [x] Radius slider in Feed and Settings

### Identity & Privacy
- [x] Three identity modes: Random / Alias / Named
- [x] Persistent alias (user-chosen handle)
- [x] Named mode shows World ID username

### Direct Messaging
- [x] End-to-end encrypted DMs (ECDH Curve25519 + AES-256-GCM)
- [x] Real-time delivery via Pusher
- [x] Conversation list + individual view

### Notifications
- [x] In-app notifications (replies, follows, DMs, @mentions, **likes, quotes, reposts**)
- [x] Real-time unread count badge via Pusher
- [x] Notification preferences (replies, DMs, follows, following posts) in Settings
- [x] Notification filter tabs (All / Replies / Mentions / Follows / DMs / **Likes / Quotes**)
- [x] World App native push notifications (Worldcoin API) — fires on reply, mention, follow, DM even when app is closed
- [x] Enriched notifications — identity-aware actor display (anonymous → "Someone", alias/named → handle)

### @ Mentions
- [x] `@handle` autocomplete in PostComposer + ReplyComposer (debounced, keyboard nav)
- [x] `parseMentions()` on post/reply save — resolves handles, creates notifications
- [x] Real-time notification delivery via Pusher on mention
- [x] Styled `@handle` spans in post body (ThreadView) and reply body (ReplyCard)
- [x] `GET /api/users/search?q=<prefix>` autocomplete endpoint (rate limited 20/min)

### Rooms (Phase 1 — Text-only, Ephemeral)
- [x] Create/join/leave ephemeral text rooms (auto-expire after 2 hours)
- [x] Identity chosen at join time (anonymous / alias / named)
- [x] Real-time messages via Pusher presence channels (ephemeral, no DB storage)
- [x] Host controls: mute / kick participants
- [x] Rooms discovery page (`/rooms`) with board filter
- [x] Rooms link in LeftDrawer
- [x] Pusher presence auth endpoint (`/api/pusher/auth`)

### Vote Reactions
- [x] `GET /api/vote/reactions?postId=X` — returns identity-aware upvoter/downvoter lists (max 50 each, no hashes exposed)
- [x] `VoteReactionsSheet` — bottom sheet with Upvotes/Downvotes tabs; fetches on open
- [x] Vote counts in VoteButtons are tappable — clicking the number opens the reactions sheet for that direction

### Repost
- [x] Straight repost (`type: 'repost'`) — shares original post to your followers instantly
- [x] Repost/quote action sheet — tap the repost icon → choose "Repost" or "Quote"
- [x] Repost display in feed: "Reposted by {handle}" header + QuotedPost card
- [x] Repost notification sent to original post author

### Sign-out Persistence Fix
- [x] `hasExplicitlySignedOut` flag in Zustand (persisted) — blocks WalletConnect auto-auth after sign-out
- [x] Settings shows "Sign in again" button when signed out

### Moderation
- [x] Block users (`/api/block`)
- [x] Report posts/replies (`/api/report`, `components/ui/ReportSheet.tsx`)
- [x] Input sanitization on all user-generated content (`lib/sanitize.ts`)
- [x] Report threshold: `reportCount` on posts; auto-hides from all feeds at ≥5 reports (post stays in DB)

### Monetization
- [x] Tips (one-time WLD token payments)
- [x] Subscriptions (recurring WLD-based creator subscriptions)
- [x] Subscription management in Settings

### Auth & Onboarding
- [x] World App walletAuth (SIWE) — auto-triggers after onboarding
- [x] World ID Orb verification (mobile: MiniKit, desktop: IDKit QR modal)
- [x] Onboarding screen (4 slides, shown once)
- [x] Sign out flow (clears cookies + Zustand auth state)
- [x] Left drawer with identity, privacy mode, appearance, sign out

### Infrastructure
- [x] Hot feed — Wilson-score time-decay ranking (`getHotFeed()` in `lib/db/posts.ts`); "🔥 Hot" tab in feed header; 60s cached
- [x] Removed unused `next-auth` dependency
- [x] In-memory feed cache (30s TTL, invalidated on new post)
- [x] Rate limiting — feed GET 60/min/IP, writes per-user
- [x] Pusher crash guard (null-check env vars + try/catch in BottomNav)
- [x] `global-error.tsx` root error boundary
- [x] Custom branded 404 page
- [x] Next.js `remotePatterns` for Hippius + Worldcoin images
- [x] Batch DB query in subscribe/list (eliminates N+1)
- [x] Comprehensive CSP headers in `next.config.ts`
- [x] `ErrorBoundary` component for subtree error isolation

---

## Code Conventions

- **Imports**: Always use `@/` path alias
- **Components**: PascalCase filenames, functional only. Client components require `'use client'`
- **Utilities/hooks**: camelCase filenames
- **API responses**: All routes return `{ success: true, data: T }` or `{ success: false, error: string }`
- **API route pattern**: validate input → check auth via `getCallerNullifier()` → rate limit → business logic → return JSON
- **Auth on server**: Always use `getCallerNullifier()` from `@/lib/serverAuth`. Never trust nullifierHash from request body.
- **Database**: New tables in `lib/db/schema.ts`, query functions in dedicated `lib/db/<entity>.ts`. Use Drizzle query builder, not raw SQL.
- **Input sanitization**: Pass user text through `sanitizeLine()` / `sanitizeText()` from `@/lib/sanitize` before DB writes.
- **Types**: Shared types in `lib/types.ts`. Use `interface`. Explicit optionals with `| undefined`.
- **No `any`**: TypeScript strict mode enforced.

---

## Architecture Notes

### Auth Model

Two separate auth steps:

1. **walletAuth** (SIWE) — runs automatically after `hasOnboarded=true`. User signs in World App → `POST /api/auth/wallet` verifies signature → sets httpOnly cookies: `arkora-nh` (nullifierHash), `wallet-address`.

2. **World ID verification** — user-triggered. Mobile: MiniKit `verify` command. Desktop: IDKit QR code modal (`hooks/useVerification.ts` + `components/auth/VerifyHuman.tsx`). Sends proof to `POST /api/verify`.
   - **Engine: Onchain.** Proof is validated via viem `readContract` against WorldIDRouter (`0x17B354dD2595411ff79041f930e491A4Df39A278`) on World Chain mainnet (chain 480) — not Worldcoin's cloud API. See `lib/worldid.ts`.
   - `verifiedBlockNumber` (bigint, nullable) recorded at time of verification. Shown in profile + settings as "Verified on World Chain · block #N".
   - Worldscan link: `https://worldscan.org/address/{walletAddress}` shown on public profiles and settings.

Cookie names: `arkora-nh`, `wallet-address`, `siwe-nonce`. Server reads identity via `getCallerNullifier()`.

### Zustand Store Shape

```
walletAddress, nullifierHash, isVerified, user          — auth state
identityMode, persistentAlias                            — identity prefs
theme, hasOnboarded                                      — app prefs
locationEnabled, locationRadius                          — location prefs
notifyReplies, notifyDms, notifyFollows, notifyFollowedPosts — notification prefs
dmPrivateKey                                             — DM encryption (client-only)
optimisticVotes, unreadNotificationCount                 — ephemeral UI
isComposerOpen, isDrawerOpen, isSearchOpen, …            — UI toggles
activeBoard                                              — current board filter
activeRoomId                                             — currently joined room (non-persisted)
```

`signOut()` clears auth state, sets `hasExplicitlySignedOut: true`, preserves preferences (theme, identity, location, notification prefs). `hasExplicitlySignedOut` (persisted) prevents WalletConnect from silently re-authing on next mount.

### Database Schema (Key Tables)

- `humanUsers` — nullifierHash (PK), walletAddress, pseudoHandle, avatarUrl, bio, identityMode, **karmaScore** (integer), **verifiedBlockNumber** (bigint, nullable — set at World ID verification time); indexed on `pseudoHandle` for mention autocomplete
- `posts` — id, title, body, boardId, nullifierHash, pseudoHandle, sessionTag, imageUrl, upvotes, downvotes, lat, lng, countryCode, quotedPostId, `type` ('text'|'poll'|'repost'), `pollOptions` (JSONB), `pollEndsAt`, `reportCount` (integer, default 0)
- `pollVotes` — id, postId (FK→posts cascade), nullifierHash, optionIndex; UNIQUE(postId, nullifierHash) enforces sybil resistance
- `replies` — id, postId, parentReplyId, content, nullifierHash, pseudoHandle, upvotes, downvotes
- `follows`, `bookmarks`, `postVotes`, `replyVotes`
- `dmKeys` — nullifierHash, publicKey (Curve25519)
- `dmMessages` — id, senderHash, recipientHash, ciphertext, nonce
- `notifications` — userId, type (`reply`/`follow`/`dm`/`mention`/`like`/`quote`/`repost`), referenceId, actorHash, read
- `subscriptions`, `tips` — monetization
- `communityNotes`, `communityNoteVotes` — fact-check system
- `blocks` — blocker/blocked user pairs
- `reports` — post/reply reports with reason
- `rooms` — id, title, boardId, hostHash, hostHandle, maxParticipants, isLive, createdAt, endsAt, messageCount
- `room_participants` — id, roomId (FK→rooms cascade), nullifierHash, displayHandle, identityMode, joinedAt, leftAt, isMuted, isCoHost

### Pusher Setup

- Server triggers via `lib/pusher.ts`
- BottomNav: subscribes to `private-user-${nullifierHash}` for `notif-count` events
- ConversationView: subscribes to `private-user-${nullifierHash}` for `new-dm` events
- All user channels are **private** (`private-user-*`) — authorized via `POST /api/pusher/auth` (prevents metadata snooping)
- Both guarded with null-check on env vars + try/catch (World App crash fix)
- Rooms: presence channel `presence-room-${roomId}`; auth via `POST /api/pusher/auth`; events: `new-message`, `participant-muted`, `participant-kicked`, `room-ended`

### Hippius S3

- `lib/storage/hippius.ts` — `@aws-sdk/client-s3`, `forcePathStyle: true`, region `'decentralized'`
- Upload key: `uploads/${Date.now()}-${filename}`
- Public URL: `${HIPPIUS_PUBLIC_URL}/${HIPPIUS_BUCKET}/${key}`
- Confirmed working in production

### Security Model (Sprint 19 Audit Summary)

Core guarantees — verified clean after comprehensive audit:

| Property | How it's enforced |
| -------- | ----------------- |
| No SQL injection | Drizzle parameterized queries only — zero raw SQL string interpolation |
| No auth bypass | Identity from `arkora-nh` httpOnly cookie only; `getCallerNullifier()` never trusts request body |
| CSRF mitigated | `SameSite=Strict` on all auth cookies; no separate CSRF token needed |
| World ID replay | Blockchain-enforced: WorldIDRouter EVM contract reverts on duplicate nullifier |
| XSS | `sanitizeLine()`/`sanitizeText()` on all user input before DB write; CSP with no `unsafe-eval` |
| Timing oracle | SIWE nonce comparison uses `crypto.timingSafeEqual()` |
| Pusher isolation | Private channels (`private-user-*`) server-authorized via `/api/pusher/auth` |

Known limitation: rate limiter is in-process (resets on Vercel cold start). Fine for early scale; upgrade to Upstash Redis at scale.

---

## Known Issues / Gotchas

- **Rate limiter is in-process.** Fresh per Vercel cold start / instance. Fine for early scale; upgrade to Upstash Redis for cross-instance enforcement.
- **Neon 20-connection limit.** Pool max set to 5 with singleton client caching. Add `?connection_limit=5` to `DATABASE_URL` if connection errors still appear.
- **DM private key in localStorage.** Users lose DM history if they clear browser data. By design for MVP.
- **Country code** inferred from `x-vercel-ip-country` header. GPS optional, sent only when `locationEnabled=true`.
- **`ADMIN_NULLIFIER_HASHES` env var** must be set in Vercel Dashboard for `/api/admin/metrics` to be accessible (comma-separated list of admin nullifier hashes).
- **Brand assets** (`/og-image.png`, `/icon-192.png`, `/icon-512.png`, `/favicon.ico`, `/apple-touch-icon.png`) must be created and placed in `public/` — blocks PWA install and social sharing previews.
- **Neon DB backups** — Neon Free tier provides 7-day automatic backup retention. Manual: `pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql`.
- **pnpm audit** — zero vulnerabilities. Patched via pnpm overrides: `minimatch >=10.2.3`, `fast-xml-parser >=5.3.8`.

---

## Deployment Checklist

- [ ] `DATABASE_URL` (Neon, with SSL)
- [ ] `PUSHER_*` + `NEXT_PUBLIC_PUSHER_*` vars
- [ ] `HIPPIUS_*` vars
- [ ] `NEXT_PUBLIC_APP_ID` / `APP_ID` matching Developer Portal
- [ ] `WORLDCOIN_API_KEY` — World App push notifications (Worldcoin Developer Portal) — code exists in `lib/worldAppNotify.ts`, just needs the key in Vercel Dashboard
- [ ] `ADMIN_NULLIFIER_HASHES` — comma-separated admin nullifier hashes for `/api/admin/metrics`
- [x] `WORLD_ID_ROUTER=0x17B354dD2595411ff79041f930e491A4Df39A278` — WorldIDRouter on World Chain
- [x] `WORLD_CHAIN_RPC=https://worldchain-mainnet.g.alchemy.com/public` — public RPC, no API key needed
- [x] `SENTRY_AUTH_TOKEN` — set in Vercel Dashboard for source map uploads (Sprint 19)
- [x] `NEXT_PUBLIC_SENTRY_DSN` — set in Vercel Dashboard (auto-added by Sentry wizard)
- [ ] Developer Portal redirect URL = production domain
- [ ] `pnpm db:push` run against production DB
- [ ] UptimeRobot monitor on `https://arkora.vercel.app/api/health`

---

## Important File Map

| File | Purpose |
|---|---|
| `store/useArkoraStore.ts` | Single source of truth for all client state |
| `lib/serverAuth.ts` | `getCallerNullifier()` — used in every auth'd API route |
| `lib/db/schema.ts` | Drizzle schema (source of truth for DB shape) |
| `lib/db/users.ts` | User CRUD + `getUsersByNullifiers` batch query + `searchUsersByHandle` (mention autocomplete) |
| `lib/db/rooms.ts` | All rooms + participants DB functions |
| `lib/sanitize.ts` | `sanitizeLine` / `sanitizeText` — strip XSS before DB writes; `parseMentions` |
| `lib/rateLimit.ts` | In-memory sliding-window rate limiter |
| `lib/cache.ts` | Feed cache with TTL |
| `lib/crypto/dm.ts` | ECDH key gen + AES-256-GCM encrypt/decrypt |
| `lib/storage/hippius.ts` | S3 upload adapter |
| `lib/pusher.ts` | Server-side Pusher trigger |
| `lib/worldid.ts` | Onchain World ID proof verification via WorldIDRouter (viem readContract, no cloud API) |
| `lib/worldAppNotify.ts` | World App native push notification helper (Worldcoin API, fire-and-forget) |
| `hooks/useVerification.ts` | World ID verify flow (MiniKit mobile + IDKit desktop) |
| `app/api/auth/wallet/route.ts` | SIWE verify + issue session cookies |
| `app/api/auth/verify/route.ts` | World ID proof verify |
| `app/api/signout/route.ts` | Clear session cookies |
| `app/api/posts/route.ts` | Feed GET (rate limited) + post create (sanitized, fires mention notifications, accepts poll fields) |
| `app/api/polls/[id]/vote/route.ts` | Cast poll vote (auth required, rate limited, idempotent via UNIQUE constraint) |
| `lib/db/polls.ts` | `castPollVote`, `getPollResults`, `getUserVote` |
| `components/compose/PollOptionInputs.tsx` | 2–4 option inputs with add/remove |
| `components/feed/PollCard.tsx` | Poll voting UI (buttons → % bars → checkmark on your vote) |
| `lib/db/karma.ts` | `updateKarma()`, `recomputeKarma()`, `getKarmaScore()`, `getKarmaTier()`, `KARMA_TIERS` |
| `components/ui/KarmaBadge.tsx` | Tier pill badge (Contributor/Trusted/Elder); no badge for Newcomer |
| `app/api/rooms/route.ts` | Rooms list + create |
| `app/api/rooms/[id]/route.ts` | Room detail + end |
| `app/api/rooms/[id]/join/route.ts` | Join room with identity choice |
| `app/api/rooms/[id]/message/route.ts` | Broadcast ephemeral message via Pusher |
| `app/api/pusher/auth/route.ts` | Pusher presence channel auth |
| `app/api/users/search/route.ts` | Handle prefix search for @mention autocomplete |
| `app/api/block/route.ts` | Block / unblock a user |
| `app/api/report/route.ts` | Report a post or reply; increments `reportCount` on target post |
| `app/api/vote/reactions/route.ts` | Identity-aware upvoter/downvoter lists for a post |
| `components/ui/VoteReactionsSheet.tsx` | Bottom sheet: Upvotes / Downvotes tabs with voter display names |
| `components/ui/VoteButtons.tsx` | Vote buttons; count numbers are tappable to open VoteReactionsSheet |
| `components/auth/VerifyHuman.tsx` | World ID verification sheet (mobile) + IDKit QR (desktop) |
| `components/auth/WalletConnect.tsx` | Auto-triggers walletAuth after onboarding |
| `components/ui/LeftDrawer.tsx` | Slide-in drawer (identity, privacy, sign out) |
| `components/ui/ReportSheet.tsx` | Report bottom sheet UI |
| `components/ui/ErrorBoundary.tsx` | React error boundary for subtree isolation |
| `components/ui/BodyText.tsx` | Renders body text with `@mention` styled spans |
| `components/ui/MentionSuggestions.tsx` | @mention autocomplete dropdown |
| `hooks/useMentionAutocomplete.ts` | Mention detection + debounced search hook |
| `components/rooms/RoomView.tsx` | Main room UI (Pusher presence subscription) |
| `components/rooms/RoomsDiscovery.tsx` | Rooms list + create sheet |
| `components/settings/SettingsView.tsx` | Full settings (identity, appearance, notifications, location, account, subs) |
| `next.config.ts` | remotePatterns, CSP headers, HSTS |

---

## Next Steps / Future Work

### Sprint 12 — Go-Live & Grant Readiness (shipped)
- [x] `GET /api/health` — health check endpoint (DB ping, returns 503 on failure)
- [x] `.github/workflows/ci.yml` — CI pipeline (lint + tsc + build on push/PR)
- [x] OG metadata — `metadataBase`, `openGraph`, `twitter`, `icons` in `app/layout.tsx`
- [x] DB indexes — `human_users_wallet_idx` (walletAddress), `posts_report_count_idx` (reportCount); both live in Neon
- [x] Auth rate limiting — `/api/nonce` (10/min/IP), `/api/auth/route` (5/min/IP), `/api/verify` (5/min/IP)
- [x] Account deletion — `DELETE /api/user` (anonymizes posts/replies, deletes user row, clears cookies); Settings UI with confirmation step
- [x] Privacy Policy — `/privacy/page.tsx`
- [x] Terms of Service — `/terms/page.tsx`
- [x] Legal links in Settings → About section
- [x] Admin metrics — `GET /api/admin/metrics` (DAU, MAU, total users, verified humans, posts/day, board breakdown, active rooms); gated by `ADMIN_NULLIFIER_HASHES` env var
- [x] Subscription fix — creator must be both `identityMode === 'named'` AND `worldIdVerified` to accept subscriptions

---

## SDLC Workflow (enforced from Sprint 20+)

**Never push directly to `main`.** All work happens on feature branches, goes through PR review, and merges only after CI passes.

### Branch naming

```text
feat/<short-description>     # new features
fix/<short-description>      # bug fixes
chore/<short-description>    # non-code changes (deps, docs, config)
security/<short-description> # security patches
```

### Workflow

1. `git checkout -b feat/your-feature` from latest `main`
2. Commit work on the branch (small, atomic commits)
3. `git push origin feat/your-feature` - Vercel creates a preview deployment automatically
4. Open a PR on GitHub - CI (test + lint + typecheck + build) must pass
5. Review preview URL on Vercel, confirm it works
6. Merge PR to `main` - Vercel deploys to production automatically
7. Delete branch after merge

### Branch protection (main)

- Direct pushes blocked
- CI must pass before merge (`ci` status check)
- Set via GitHub API once repo is public: `gh api repos/het4rk/arkora/branches/main/protection`

### Commit message format

```text
<type>(<scope>): <short description>

feat(feed): add location-based filtering
fix(auth): resolve cookie expiry on signout
security(api): enforce rate limit on DM endpoint
chore(deps): upgrade vitest to 4.0.18
```

---

### Remaining Launch Work (manual / not yet shipped)

- [ ] **Create brand assets**: `/public/og-image.png` (1200×630), `/public/icon-192.png`, `/public/icon-512.png`, `/public/favicon.ico`, `/public/apple-touch-icon.png` — blocks PWA + social sharing
- [ ] **Rotate all production secrets**: Verify `.env.local` not in git history (`git log --all --full-history -- .env.local`); rotate Neon password, Pusher, Hippius, Worldcoin API key if any commits found
- [ ] **Set `ADMIN_NULLIFIER_HASHES`** in Vercel Dashboard — your nullifier hash for accessing `/api/admin/metrics`
- [ ] **UptimeRobot**: monitor `https://arkora.vercel.app/api/health` every 5 minutes
- [ ] **Upgrade rate limiter** to Upstash Redis for cross-instance enforcement at scale
- [ ] **Upgrade DB driver** to `@neondatabase/serverless` to eliminate TCP connection limits
- [ ] **Pusher Starter plan** ($49/mo) for 500 concurrent connections when user base grows
- [ ] MCP / public API for verified-human poll data (post-launch, novel data product)
- [ ] Rooms Phase 2 — audio (WebRTC or LiveKit)
- [ ] Admin moderation queue for reports
- [x] Testing — 69 Vitest unit tests covering sanitize, rateLimit, crypto/dm, karma, utils (`pnpm test`)
- [ ] Playwright E2E tests (post-launch)
- [ ] Custom domain (`arkora.world` or similar)

- [x] Sprint 20 (open source + CI/CD): Vitest unit test suite (69 tests), MIT + CI badges, open source declaration, @sentry/cli build fix, signout cookie `secure: true`, Bittensor decentralization architecture in README, branch protection on main (enforced via GitHub API post-public), SDLC workflow documented
- [x] Sprint 13: Onchain World ID verification (WorldIDRouter on World Chain), verifiedBlockNumber, identity merge fix
- [x] Sprint 14: ArkoraNullifierRegistry.sol contract + server-side registration (lib/registry.ts), post SHA-256 content hashes (tamper evidence), registrationTxHash in settings UI
- [x] Sprint 15: Dynamic board system (synonym dedup + Levenshtein matching), PostComposer UX overhaul (inline poll expansion), profile name locked to World ID in World App
- [x] Sprint 16: Tip recipient push notification (worldAppNotify), tip total displayed on public profiles, rooms auto-close when last participant leaves, karma score in feed cards (authorKarmaScore on Post type, JOIN in all feed queries)
- [x] Sprint 17 (polish): TipModal desktop guard + cancel-tx protection, ConversationView Pusher error banner + better no-key message, ReplyComposer textarea max-height, PostComposer body char counter, imageUrl validation in /api/replies, rate limit on /api/u/[id] + /api/me + /api/boards, URL max-length 2048 on posts+replies, BottomNav 44px touch targets + larger notification badge

### Previous Sprints
- [x] World App native push notifications via Worldcoin API (`lib/worldAppNotify.ts`)
- [x] Sybil-resistant polls — Sprint 7
- [x] Reputation/karma score — Sprint 8
- [x] Confessions board — Sprint 9
- [x] Sign-out persistence, report auto-hide, like/quote/repost notifications, vote reactions, repost feature — Sprint 10
- [x] Rooms Phase 1 (text-only ephemeral) — Sprint 10
- [x] Rooms creator auto-join fix, profile display name migration, light theme polish — Sprint 11
- [x] Production hardening: auth bypass fix, atomic votes, private Pusher channels, CSP hardened, account deletion cleanup, dead code removal — Sprint 18
- [x] Security audit + hardening (Sprint 19): comprehensive 4-layer audit (SQL injection, auth bypass, XSS/CSRF, rate limiting/headers/infra); 12 confirmed issues patched; Sentry error tracking integrated; CI upgraded to Node 22; GitHub community files added
