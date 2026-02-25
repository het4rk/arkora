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
- [x] In-app notifications (replies, follows, DMs, @mentions)
- [x] Real-time unread count badge via Pusher
- [x] Notification preferences (replies, DMs, follows, following posts) in Settings
- [x] Notification filter tabs (All / Replies / Mentions / Follows / DMs)
- [x] World App native push notifications (Worldcoin API) — fires on reply, mention, follow, DM even when app is closed

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
activeRoomId                                             — currently joined room (non-persisted)
```

`signOut()` clears auth state, preserves preferences (theme, identity, location, notification prefs).

### Database Schema (Key Tables)

- `humanUsers` — nullifierHash (PK), walletAddress, pseudoHandle, avatarUrl, bio, identityMode, **karmaScore** (integer); indexed on `pseudoHandle` for mention autocomplete
- `posts` — id, title, body, boardId, nullifierHash, pseudoHandle, sessionTag, imageUrl, upvotes, downvotes, lat, lng, countryCode, quotedPostId, `type` ('text'|'poll'), `pollOptions` (JSONB), `pollEndsAt`
- `pollVotes` — id, postId (FK→posts cascade), nullifierHash, optionIndex; UNIQUE(postId, nullifierHash) enforces sybil resistance
- `replies` — id, postId, parentReplyId, content, nullifierHash, pseudoHandle, upvotes, downvotes
- `follows`, `bookmarks`, `postVotes`, `replyVotes`
- `dmKeys` — nullifierHash, publicKey (Curve25519)
- `dmMessages` — id, senderHash, recipientHash, ciphertext, nonce
- `notifications` — userId, type (`reply`/`follow`/`dm`/`mention`), referenceId, actorHash, read
- `subscriptions`, `tips` — monetization
- `communityNotes`, `communityNoteVotes` — fact-check system
- `blocks` — blocker/blocked user pairs
- `reports` — post/reply reports with reason
- `rooms` — id, title, boardId, hostHash, hostHandle, maxParticipants, isLive, createdAt, endsAt, messageCount
- `room_participants` — id, roomId (FK→rooms cascade), nullifierHash, displayHandle, identityMode, joinedAt, leftAt, isMuted, isCoHost

### Pusher Setup

- Server triggers via `lib/pusher.ts`
- BottomNav: subscribes to `user-${nullifierHash}` for `notif-count` events
- ConversationView: subscribes to `user-${nullifierHash}` for `new-dm` events
- Both guarded with null-check on env vars + try/catch (World App crash fix)
- Rooms: presence channel `presence-room-${roomId}`; auth via `POST /api/pusher/auth`; events: `new-message`, `participant-muted`, `participant-kicked`, `room-ended`

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
- [ ] `WORLDCOIN_API_KEY` — World App push notifications (Worldcoin Developer Portal)
- [ ] Developer Portal redirect URL = production domain
- [ ] `pnpm db:push` run against production DB

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
| `app/api/report/route.ts` | Report a post or reply |
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

- [x] World App native push notifications via Worldcoin API (`lib/worldAppNotify.ts`)
- [x] Sybil-resistant polls — Sprint 7 shipped
- [x] Reputation/karma score — Sprint 8 shipped
- [x] Confessions board (force-anonymous verified human posts) — Sprint 9 shipped
- [ ] WLD tipping leaderboard + tip amount on posts (Sprint 9b)
- [ ] Admin moderation queue for reports
- [ ] Upgrade rate limiter to Upstash Redis for cross-instance enforcement
- [ ] Add `connection_limit` to DATABASE_URL for Neon pooling
- [ ] Remove unused `next-auth` package
- [ ] World Chain smart contract for on-chain votes (`contracts/ArkVotes.sol`)
- [x] Rooms feature — Phase 1 text-only shipped
- [ ] Rooms Phase 2 — audio (WebRTC or LiveKit)
- [ ] Multi-language support
- [ ] Light theme polish
