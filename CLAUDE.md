# CLAUDE.md — Arkora Project Context

This file is loaded automatically by Claude Code at the start of every session. It provides project history, architecture notes, conventions, and next steps.

**Live URL:** https://arkora.vercel.app
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
- **Blockchain**: viem on World Chain (ArkVotes.sol)
- **Crypto**: `@noble/curves` (Curve25519 ECDH), `@noble/hashes` (HKDF-SHA256), Web Crypto (AES-256-GCM)
- **File storage**: Hippius S3 (`lib/storage/hippius.ts`, S3-compatible)
- **Animations**: Framer Motion

---

## What's Been Built (Shipped Features)

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
- [x] In-app notifications (replies, follows, DMs)
- [x] Real-time unread count badge via Pusher
- [x] Notification preferences (replies, DMs, follows, following posts) in Settings

### Moderation
- [x] Block users (`/api/block`)
- [x] Report posts/replies (`/api/report`, `components/ui/ReportSheet.tsx`)
- [x] Input sanitization on all user-generated content (`lib/sanitize.ts`)

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

2. **World ID verification** — user-triggered. Mobile: MiniKit `verify` command. Desktop: IDKit QR code modal (`hooks/useVerification.ts` + `components/auth/VerifyHuman.tsx`). Sends proof to `POST /api/auth/verify`.

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
```

`signOut()` clears auth state, preserves preferences (theme, identity, location, notification prefs).

### Database Schema (Key Tables)

- `humanUsers` — nullifierHash (PK), walletAddress, pseudoHandle, avatarUrl, bio, identityMode
- `posts` — id, title, body, boardId, nullifierHash, pseudoHandle, sessionTag, imageUrl, upvotes, downvotes, lat, lng, countryCode, quotedPostId
- `replies` — id, postId, parentReplyId, content, nullifierHash, pseudoHandle, upvotes, downvotes
- `follows`, `bookmarks`, `postVotes`, `replyVotes`
- `dmKeys` — nullifierHash, publicKey (Curve25519)
- `dmMessages` — id, senderHash, recipientHash, ciphertext, nonce
- `notifications` — userId, type (reply/follow/dm), referenceId, read
- `subscriptions`, `tips` — monetization
- `communityNotes`, `communityNoteVotes` — fact-check system
- `blocks` — blocker/blocked user pairs
- `reports` — post/reply reports with reason

### Pusher Setup

- Server triggers via `lib/pusher.ts`
- BottomNav: subscribes to `user-${nullifierHash}` for `notif-count` events
- ConversationView: subscribes to `user-${nullifierHash}` for `new-dm` events
- Both guarded with null-check on env vars + try/catch (World App crash fix)

### Hippius S3

- `lib/storage/hippius.ts` — `@aws-sdk/client-s3`, `forcePathStyle: true`, region `'decentralized'`
- Upload key: `uploads/${Date.now()}-${filename}`
- Public URL: `${HIPPIUS_PUBLIC_URL}/${HIPPIUS_BUCKET}/${key}`
- Confirmed working in production

---

## Known Issues / Gotchas

- **`next-auth` installed but unused.** Custom SIWE flow is used instead. Safe to remove.
- **Rate limiter is in-process.** Fresh per Vercel cold start / instance. Fine for 20 users; upgrade to Upstash Redis at scale.
- **Neon 20-connection limit.** Add `?connection_limit=10` to `DATABASE_URL` if connection errors appear.
- **DM private key in localStorage.** Users lose DM history if they clear browser data. By design for MVP.
- **Country code** inferred from `x-vercel-ip-country` header. GPS optional, sent only when `locationEnabled=true`.

---

## Deployment Checklist

- [ ] `DATABASE_URL` (Neon, with SSL)
- [ ] `NEXTAUTH_SECRET` (random 32-char)
- [ ] `NEXTAUTH_URL` (production domain)
- [ ] `PUSHER_*` + `NEXT_PUBLIC_PUSHER_*` vars
- [ ] `HIPPIUS_*` vars
- [ ] `NEXT_PUBLIC_APP_ID` / `APP_ID` matching Developer Portal
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
| `lib/sanitize.ts` | `sanitizeLine` / `sanitizeText` — strip XSS before DB writes |
| `lib/rateLimit.ts` | In-memory sliding-window rate limiter |
| `lib/cache.ts` | Feed cache with TTL |
| `lib/crypto/dm.ts` | ECDH key gen + AES-256-GCM encrypt/decrypt |
| `lib/storage/hippius.ts` | S3 upload adapter |
| `lib/pusher.ts` | Server-side Pusher trigger |
| `hooks/useVerification.ts` | World ID verify flow (MiniKit mobile + IDKit desktop) |
| `app/api/auth/wallet/route.ts` | SIWE verify + issue session cookies |
| `app/api/auth/verify/route.ts` | World ID proof verify |
| `app/api/signout/route.ts` | Clear session cookies |
| `app/api/posts/route.ts` | Feed GET (rate limited) + post create (sanitized) |
| `app/api/block/route.ts` | Block / unblock a user |
| `app/api/report/route.ts` | Report a post or reply |
| `components/auth/VerifyHuman.tsx` | World ID verification sheet (mobile) + IDKit QR (desktop) |
| `components/auth/WalletConnect.tsx` | Auto-triggers walletAuth after onboarding |
| `components/ui/LeftDrawer.tsx` | Slide-in drawer (identity, privacy, sign out) |
| `components/ui/ReportSheet.tsx` | Report bottom sheet UI |
| `components/ui/ErrorBoundary.tsx` | React error boundary for subtree isolation |
| `components/settings/SettingsView.tsx` | Full settings (identity, appearance, notifications, location, account, subs) |
| `next.config.ts` | remotePatterns, CSP headers, HSTS |

---

## Next Steps / Future Work

- [ ] Push notifications (Web Push API or World App native)
- [ ] Trending / hot posts algorithm (time-decay scoring)
- [ ] Admin moderation queue for reports
- [ ] Upgrade rate limiter to Upstash Redis for cross-instance enforcement
- [ ] Add `connection_limit` to DATABASE_URL for Neon pooling
- [ ] Remove unused `next-auth` package
- [ ] World Chain smart contract for on-chain votes (`contracts/ArkVotes.sol`)
- [ ] Rooms feature (see `.github/ISSUE_ROOMS_FEATURE.md`)
- [ ] Multi-language support
- [ ] Light theme polish
