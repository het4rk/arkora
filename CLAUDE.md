# CLAUDE.md — Arkora Project Context

This file is loaded automatically by Claude Code at the start of every session. It provides project history, architecture notes, and next steps to avoid re-explaining context.

---

## Project Summary

**Arkora** is a provably human anonymous social message board built as a **World App miniapp**. Users post and interact anonymously, but every account is backed by a World ID Orb verification proof. Think: TikTok scroll feed, 4chan anonymity, Reddit boards, all with zero fake accounts.

**Live URL:** https://arkora.vercel.app
**World App Developer Portal:** https://developer.worldcoin.org (app registered as a miniapp)

**Tech stack:** Next.js 15 App Router · Neon Postgres · Drizzle ORM · Zustand · Pusher · Hippius S3 · Framer Motion · World MiniKit · viem

---

## What's Been Built (Shipped Features)

### Core
- [x] Snap-scroll vertical feed (TikTok-style) with cards
- [x] 5 topic boards (arkora, technology, markets, politics, worldchain)
- [x] Post creation with title, body, optional image upload (Hippius S3)
- [x] Post quotes (embed another post inline)
- [x] Threaded replies with nested voting
- [x] Upvote / downvote (optimistic UI, persisted server-side)
- [x] Community Notes (fact-checking system, Wikipedia-style)
- [x] Bookmarks
- [x] Full-text search (posts + boards)
- [x] User profiles with avatar, bio, identity mode
- [x] Follow / unfollow users
- [x] Following feed tab

### Location
- [x] Local feed tab — GPS-filtered posts by radius (1 mi → Country)
- [x] Optional location tagging on posts (enabled per-user in settings)
- [x] Radius slider in both Feed and Settings

### Identity & Privacy
- [x] Three identity modes: Random (anonymous) / Alias / Named
- [x] Persistent alias (user-chosen handle, stored locally)
- [x] Named mode shows World ID username

### Direct Messaging
- [x] End-to-end encrypted DMs (ECDH Curve25519 + AES-256-GCM)
- [x] Key generation and registration (`/api/dm/keys`)
- [x] Real-time delivery via Pusher (replaced 7s polling)
- [x] Conversation list + individual conversation view

### Notifications
- [x] In-app notifications (replies, follows, DMs)
- [x] Real-time unread count badge via Pusher
- [x] Read/unread state

### Monetization
- [x] Tips (one-time WLD token payments)
- [x] Subscriptions (recurring WLD-based creator subscriptions)
- [x] Subscription management in Settings

### Auth & Onboarding
- [x] World App walletAuth (SIWE) — auto-triggers after onboarding
- [x] World ID Orb verification (separate step, gated on `hasOnboarded`)
- [x] Onboarding screen (4 slides, shown once)
- [x] Sign out flow (clears cookies + Zustand auth state)
- [x] Left drawer with identity header, privacy mode, appearance, sign out

### Infrastructure
- [x] In-memory feed cache (30s TTL, invalidated on new post)
- [x] In-memory rate limiter (per-IP for feed, per-user for writes)
- [x] Pusher crash guard (null-check env vars + try/catch in BottomNav)
- [x] `global-error.tsx` root error boundary with actual error message
- [x] Custom branded 404 page (`app/not-found.tsx`)
- [x] Next.js `remotePatterns` for Hippius + Worldcoin image hostnames
- [x] Batch DB query for subscribe/list (eliminates N+1)

---

## Architecture Notes

### Auth Model

Two separate auth steps:

1. **walletAuth** (SIWE) — runs automatically after onboarding. Signs a message in World App, sends to `POST /api/auth/wallet`. Server verifies signature, sets two httpOnly cookies: `arkora-nh` (nullifierHash) and `wallet-address`. This establishes a session.

2. **World ID verification** — user-triggered (tap "Verify" CTA). Calls MiniKit `verify` command, sends proof to `POST /api/auth/verify`. Marks the user as `isVerified=true` in the store. Required to post, reply, vote.

Session cookie names: `arkora-nh`, `wallet-address`, `siwe-nonce`.
Server reads caller identity with `getCallerNullifier()` from `lib/serverAuth.ts`.

### Zustand Store Shape

Key fields in `store/useArkoraStore.ts`:

```
walletAddress, nullifierHash, isVerified, user     — auth state
identityMode, persistentAlias                       — identity prefs
theme, hasOnboarded                                 — app prefs
locationEnabled, locationRadius                     — location prefs
dmPrivateKey                                        — DM encryption (never sent to server)
optimisticVotes, unreadNotificationCount            — ephemeral UI
isComposerOpen, isDrawerOpen, isSearchOpen, …       — UI toggles
activeBoard                                         — current board filter
```

Persisted to localStorage (via Zustand persist middleware). `signOut()` clears auth state but keeps preferences (theme, hasOnboarded, identityMode, locationRadius, persistentAlias).

### Database Schema (Key Tables)

- `humanUsers` — nullifierHash (PK), walletAddress, pseudoHandle, avatarUrl, bio, identityMode
- `posts` — id, title, body, boardId, nullifierHash, pseudoHandle, sessionTag, imageUrl, upvotes, downvotes, lat, lng, countryCode, quotedPostId
- `replies` — id, postId, parentReplyId (nullable, for nesting), content, nullifierHash, pseudoHandle, sessionTag, upvotes, downvotes
- `follows`, `bookmarks`, `postVotes`, `replyVotes`
- `dmKeys` — nullifierHash, publicKey (Curve25519)
- `dmMessages` — id, senderHash, recipientHash, ciphertext, nonce
- `notifications` — userId, type (reply/follow/dm), referenceId, read
- `subscriptions`, `tips` — monetization
- `communityNotes`, `communityNoteVotes` — fact-check system

### Pusher Setup

- Server triggers events via `lib/pusher.ts` (server-side Pusher client)
- BottomNav subscribes to `user-${nullifierHash}` for `notif-count` events
- ConversationView subscribes to `user-${nullifierHash}` for `new-dm` events
- Both wrapped in try/catch + null-check for env vars (World App crash guard)

### Hippius S3

- Adapter at `lib/storage/hippius.ts`, using `@aws-sdk/client-s3` with `forcePathStyle: true`
- Endpoint: `https://s3.hippius.com`, region: `'decentralized'`
- Upload key: `uploads/${Date.now()}-${filename}`
- Public URL: `${HIPPIUS_PUBLIC_URL}/${HIPPIUS_BUCKET}/${key}`
- Confirmed working: upload + public GET both return 200

### Feed Cache

`lib/cache.ts` — in-memory Map keyed by stringified feed params, 30s TTL.
`invalidatePosts()` clears all feed cache entries (called after `createPost`).
Local feed and following feed bypass cache (personal/real-time).

### Rate Limiting

`lib/rateLimit.ts` — sliding window, in-memory per Vercel instance.
Key limits: feed GET (60/min/IP), post create (5/min/user), replies (10/min/user).
Not cross-instance — upgrade to Upstash Redis when scaling beyond 1 instance.

---

## Known Issues / Gotchas

- **`next-auth` package is installed but unused.** The project uses a custom cookie-based auth flow (SIWE). `next-auth` is a leftover from an earlier prototype — safe to remove.
- **Rate limiter is in-process.** On Vercel each cold start = fresh state. Fine for 20 users; at high traffic multiple instances will each have their own store.
- **Neon 20-connection limit.** Use `?connection_limit=10` in DATABASE_URL if seeing connection errors at scale. Drizzle doesn't pool by default.
- **DM private key in localStorage.** If a user clears their browser data or switches devices, they lose their DM key and can't decrypt old messages. This is by design for the current MVP.
- **Location tagging**: Country code is inferred from Vercel's `x-vercel-ip-country` header. GPS coords are optional and only sent when `locationEnabled=true` in user settings.

---

## Deployment Checklist

- [ ] `DATABASE_URL` set in Vercel (Neon connection string with SSL)
- [ ] `NEXTAUTH_SECRET` set (random 32-char string)
- [ ] `NEXTAUTH_URL` set to production domain
- [ ] All `PUSHER_*` and `NEXT_PUBLIC_PUSHER_*` vars set
- [ ] All `HIPPIUS_*` vars set
- [ ] `NEXT_PUBLIC_APP_ID` / `APP_ID` match Developer Portal app
- [ ] Developer Portal redirect URL = production domain
- [ ] `pnpm db:push` run against production DB

---

## Important File Map

| File | Purpose |
|---|---|
| `store/useArkoraStore.ts` | Single source of truth for all client state |
| `lib/serverAuth.ts` | `getCallerNullifier()` — used in every auth'd API route |
| `lib/db/schema.ts` | Drizzle schema (source of truth for DB shape) |
| `lib/db/users.ts` | User CRUD + `getUsersByNullifiers` batch query |
| `lib/rateLimit.ts` | In-memory rate limiter |
| `lib/cache.ts` | Feed cache with TTL |
| `lib/crypto/dm.ts` | ECDH key gen + AES-256-GCM encrypt/decrypt |
| `lib/storage/hippius.ts` | S3 upload adapter |
| `lib/pusher.ts` | Server-side Pusher trigger |
| `app/api/auth/wallet/route.ts` | SIWE verify + issue session cookies |
| `app/api/auth/verify/route.ts` | World ID proof verify |
| `app/api/signout/route.ts` | Clear session cookies |
| `app/api/posts/route.ts` | Feed GET (rate limited) + post create |
| `components/auth/WalletConnect.tsx` | Auto-triggers walletAuth after onboarding |
| `components/auth/VerifyHuman.tsx` | World ID verification bottom sheet |
| `components/onboarding/OnboardingScreen.tsx` | First-run 4-slide onboarding |
| `components/ui/LeftDrawer.tsx` | Slide-in drawer (identity, privacy, sign out) |
| `components/settings/SettingsView.tsx` | Full settings page |
| `next.config.ts` | Image remote patterns, CSP headers, HSTS |

---

## Next Steps / Future Work

- [ ] Push notifications (Web Push API or World App native)
- [ ] Trending / hot posts algorithm (time-decay scoring)
- [ ] Post reporting & moderation queue
- [ ] Upgrade rate limiter to Upstash Redis for cross-instance enforcement
- [ ] Add `connection_limit` to DATABASE_URL for Neon connection pooling
- [ ] Remove unused `next-auth` package
- [ ] World Chain smart contract for on-chain votes (ArkVotes.sol stub exists in `contracts/`)
- [ ] Multi-language support (i18n)
- [ ] Dark/light theme polish (light mode may need some color token adjustments)
