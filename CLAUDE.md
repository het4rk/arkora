# CLAUDE.md - Arkora Project Context

This file is loaded automatically by Claude Code at the start of every session. It provides project architecture, conventions, and operational context.

**Live URL:** <https://arkora.vercel.app>
**Twitter:** [@humansposting](https://x.com/humansposting)
**Developer Portal:** <https://developer.worldcoin.org>

---

## Commands

```bash
pnpm dev              # Next.js dev server (Turbopack)
pnpm build            # Production build
pnpm lint             # ESLint
pnpm test             # Run all tests (69 Vitest unit tests)
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
- **Monitoring**: Sentry (error tracking + session replay) + Vercel Analytics

---

## Code Conventions

- **Imports**: Always use `@/` path alias
- **Components**: PascalCase filenames, functional only. Client components require `'use client'`
- **Utilities/hooks**: camelCase filenames
- **API responses**: All routes return `{ success: true, data: T }` or `{ success: false, error: string }`
- **API route pattern**: validate input -> check auth via `getCallerNullifier()` -> rate limit -> business logic -> return JSON
- **Auth on server**: Always use `getCallerNullifier()` from `@/lib/serverAuth`. Never trust nullifierHash from request body.
- **Database**: New tables in `lib/db/schema.ts`, query functions in dedicated `lib/db/<entity>.ts`. Use Drizzle query builder, not raw SQL.
- **Input sanitization**: Pass user text through `sanitizeLine()` / `sanitizeText()` from `@/lib/sanitize` before DB writes.
- **Types**: Shared types in `lib/types.ts`. Use `interface`. Explicit optionals with `| undefined`.
- **No `any`**: TypeScript strict mode enforced.

---

## Architecture

### Auth Model

Two separate auth steps:

1. **walletAuth** (SIWE) - runs automatically after `hasOnboarded=true`. User signs in World App -> `POST /api/auth/wallet` verifies signature -> sets httpOnly cookies: `arkora-nh` (nullifierHash), `wallet-address`.

2. **World ID verification** - user-triggered. Mobile: MiniKit `verify` command. Desktop: IDKit QR code modal (`hooks/useVerification.ts` + `components/auth/VerifyHuman.tsx`). Sends proof to `POST /api/verify`.
   - **Engine: Onchain.** Proof validated via viem `readContract` against WorldIDRouter (`0x17B354dD2595411ff79041f930e491A4Df39A278`) on World Chain mainnet (chain 480). See `lib/worldid.ts`.
   - `verifiedBlockNumber` (bigint, nullable) recorded at verification time. Shown in profile + settings.

Cookie names: `arkora-nh`, `wallet-address`, `siwe-nonce`. Server reads identity via `getCallerNullifier()`.

### Zustand Store

```text
walletAddress, nullifierHash, isVerified, user          - auth state
identityMode, persistentAlias                            - identity prefs
locale, theme, hasOnboarded                               - app prefs (locale persisted)
activeSkinId, customHex, ownedSkins                      - skin/accent color
activeFontId, ownedFonts                                 - font preference
locationEnabled, locationRadius                          - location prefs
notifyReplies, notifyDms, notifyFollows, notifyFollowedPosts - notification prefs
dmPrivateKey                                             - DM encryption (client-only)
optimisticVotes, unreadNotificationCount                 - ephemeral UI (not persisted)
isComposerOpen, isSearchOpen, ...                        - UI toggles
activeBoard                                              - current board filter
activeRoomId                                             - currently joined room
```

`signOut()` clears auth state, sets `hasExplicitlySignedOut: true`, resets skin/font to defaults, clears activeBoard/activeRoomId. `hasExplicitlySignedOut` (persisted) prevents WalletConnect from silently re-authing on next mount.

All user preferences are synced server-side in `humanUsers`. On login, `SessionHydrator` fetches `/api/preferences`, `/api/skins`, `/api/fonts` and hydrates Zustand. On change, fire-and-forget PATCH calls persist across devices.

### Database Schema (Key Tables)

- `humanUsers` - nullifierHash (PK), walletAddress, pseudoHandle, avatarUrl, bio, identityMode, karmaScore, verifiedBlockNumber, activeSkinId, customHex, activeFontId, theme, notification booleans, locationEnabled, locationRadius
- `posts` - id, title, body, boardId, nullifierHash, pseudoHandle, sessionTag, imageUrl, upvotes, downvotes, lat, lng, countryCode, quotedPostId, type ('text'|'poll'|'repost'), pollOptions (JSONB), pollEndsAt, reportCount, viewCount, contentHash
- `pollVotes` - postId, nullifierHash, optionIndex; UNIQUE(postId, nullifierHash) enforces sybil resistance
- `replies` - id, postId, parentReplyId, content, nullifierHash, pseudoHandle, upvotes, downvotes
- `follows`, `bookmarks`, `postVotes`, `replyVotes`, `post_views`
- `dmKeys` - nullifierHash, publicKey (Curve25519)
- `dmMessages` - senderHash, recipientHash, ciphertext, nonce
- `notifications` - userId, type (reply/follow/dm/mention/like/quote/repost), referenceId, actorHash, read
- `skinPurchases` - buyerHash, skinId, amountWld, txId; unique(buyerHash, skinId)
- `fontPurchases` - buyerHash, fontId, amountWld, txId; unique(buyerHash, fontId)
- `subscriptions`, `tips` - monetization
- `communityNotes`, `communityNoteVotes` - fact-check system
- `blocks`, `reports` - moderation
- `rooms` - id, title, boardId, hostHash, isLive, endsAt, messageCount
- `room_participants` - roomId, nullifierHash, displayHandle, identityMode, isMuted, isCoHost
- `api_keys` - id (uuid), nullifierHash (owner), keyHash (SHA-256), label, lastUsedAt, revokedAt; max 5 active per user

### Pusher

- Server triggers via `lib/pusher.ts`
- All user channels are **private** (`private-user-*`) - authorized via `POST /api/pusher/auth`
- BottomNav subscribes for `notif-count` events
- ConversationView subscribes for `new-dm` events
- Rooms use presence channels `presence-room-${roomId}`
- Guarded with null-check on env vars + try/catch

### i18n (Internationalization)

- **Supported locales (10):** `en`, `es`, `pt`, `fr`, `de`, `ja`, `ko`, `th`, `id`, `tr`
- **Source of truth:** `lib/i18n/en.ts` defines all keys (`TKey`) and the English dictionary. `LOCALES` array in `lib/i18n/index.ts` is the single source for the `Locale` type and runtime list
- **Lazy loading:** Only English is bundled. Other dictionaries are loaded via dynamic `import()` on demand, cached in a `Map` after first load. English path skips the async round-trip entirely
- **Hook:** `hooks/useT.ts` exports `useT()` which returns a `(key: TKey) => string` function. Falls back to English for missing keys
- **Auto-detection:** `LocaleDetector` reads `navigator.language` on first visit and sets locale. Also keeps `<html lang>` in sync for screen readers
- **Persistence:** `locale` is stored in Zustand (persisted to localStorage). Manual override via language picker in Settings
- **Adding a new locale:** Add code to `LOCALES` array in `lib/i18n/index.ts`, add label to `LOCALE_LABELS`, create `lib/i18n/<code>.ts` exporting `Dict`, add dynamic import entry to `dictionaries`. Locale type and picker derive automatically

### Security Model

| Property | Enforcement |
| --- | --- |
| No SQL injection | Drizzle parameterized queries only |
| No auth bypass | Identity from `arkora-nh` httpOnly cookie only via `getCallerNullifier()` |
| CSRF mitigated | `SameSite=Strict` on all auth cookies |
| World ID replay | WorldIDRouter EVM contract reverts on duplicate nullifier |
| XSS | `sanitizeLine()`/`sanitizeText()` on all input; CSP with no `unsafe-eval` |
| Timing oracle | SIWE nonce uses `crypto.timingSafeEqual()` |
| Pusher isolation | Private channels server-authorized via `/api/pusher/auth` |
| Cookie validation | `getCallerNullifier()` validates format with regex before returning |
| Rate limiting | Per-endpoint, per-user sliding window; full API key used (not truncated) |

Known limitation: rate limiter is in-process (resets on Vercel cold start). Sufficient for early scale; upgrade to Upstash Redis later.

---

## Important File Map

| File | Purpose |
| --- | --- |
| `store/useArkoraStore.ts` | Single source of truth for all client state |
| `lib/serverAuth.ts` | `getCallerNullifier()` - cookie auth with format validation |
| `lib/db/schema.ts` | Drizzle schema (source of truth for DB shape) |
| `lib/db/users.ts` | User CRUD + batch query + mention autocomplete |
| `lib/db/posts.ts` | Post queries + hot feed (Wilson-score time-decay) |
| `lib/db/rooms.ts` | Rooms + participants DB functions |
| `lib/db/search.ts` | Full-text search (posts), prefix-first search (boards, users) |
| `lib/db/karma.ts` | Karma scoring + tier calculation |
| `lib/db/polls.ts` | Poll vote casting + results |
| `lib/db/fonts.ts` | Font purchase + activation queries |
| `lib/sanitize.ts` | `sanitizeLine` / `sanitizeText` / `parseMentions` |
| `lib/rateLimit.ts` | In-memory sliding-window rate limiter |
| `lib/cache.ts` | Feed cache with TTL (unstable_cache) |
| `lib/crypto/dm.ts` | ECDH key gen + AES-256-GCM encrypt/decrypt |
| `lib/storage/hippius.ts` | S3 upload adapter |
| `lib/worldid.ts` | Onchain World ID proof verification (viem readContract) |
| `lib/worldAppNotify.ts` | World App native push notification helper |
| `lib/fonts.ts` | Font catalog (7 entries), `getFontById()`, `isValidFontId()` |
| `lib/skins.ts` | Skin catalog, hex utilities |
| `lib/apiKeyAuth.ts` | `requireApiKey()` middleware for v1 routes |
| `lib/i18n/en.ts` | English dictionary (source of truth for all TKey types) |
| `lib/i18n/index.ts` | Locale type, lazy dictionary loader, detectLocale() |
| `hooks/useT.ts` | `useT()` translation hook - returns `(key: TKey) => string` |
| `hooks/useVerification.ts` | World ID verify flow (MiniKit mobile + IDKit desktop) |
| `hooks/useFeed.ts` | Feed data fetching + pagination + cache |
| `hooks/useMentionAutocomplete.ts` | @mention detection + debounced autocomplete |
| `components/auth/SessionHydrator.tsx` | Hydrates Zustand from server on login (skins, fonts, preferences) |
| `components/providers/SkinProvider.tsx` | Applies skin CSS vars from Zustand |
| `components/providers/FontProvider.tsx` | Injects Google Fonts + sets --font-override CSS var |
| `components/settings/SkinShop.tsx` | Skin purchase + live preview before purchase |
| `components/settings/FontShop.tsx` | Font purchase + live preview before purchase |
| `components/settings/SettingsView.tsx` | Full settings page |
| `components/search/SearchSheet.tsx` | Multi-entity search modal |
| `next.config.ts` | CSP headers, HSTS, remotePatterns, Sentry config |

---

## Known Issues

- **Rate limiter is in-process.** Resets on Vercel cold start. Fine for early scale; upgrade to Upstash Redis for cross-instance enforcement.
- **Neon 20-connection limit.** Pool max set to 5 with singleton client caching.
- **DM private key in localStorage.** Users lose DM history if they clear browser data. By design for MVP.
- **Country code** inferred from `x-vercel-ip-country` header. GPS optional, sent only when `locationEnabled=true`.
- **Brand assets** (`/og-image.png`, `/icon-192.png`, `/icon-512.png`, `/favicon.ico`, `/apple-touch-icon.png`) must be created - blocks PWA install and social sharing previews.
- **pnpm audit** - zero vulnerabilities. Patched via pnpm overrides: `minimatch >=10.2.3`, `fast-xml-parser >=5.3.8`.

---

## Deployment Checklist

- [ ] `DATABASE_URL` (Neon, with SSL)
- [ ] `PUSHER_*` + `NEXT_PUBLIC_PUSHER_*` vars
- [ ] `HIPPIUS_*` vars
- [ ] `NEXT_PUBLIC_APP_ID` / `APP_ID` matching Developer Portal
- [ ] `NEXT_PUBLIC_ACTION_ID` matching Developer Portal action
- [ ] `WORLDCOIN_API_KEY` for World App push notifications
- [ ] `ADMIN_NULLIFIER_HASHES` for `/api/admin/metrics`
- [x] `WORLD_ID_ROUTER=0x17B354dD2595411ff79041f930e491A4Df39A278`
- [x] `WORLD_CHAIN_RPC=https://worldchain-mainnet.g.alchemy.com/public`
- [x] `SENTRY_AUTH_TOKEN` + `NEXT_PUBLIC_SENTRY_DSN` in Vercel
- [ ] Developer Portal redirect URL = production domain
- [ ] `pnpm db:push` run against production DB
- [ ] UptimeRobot monitor on `/api/health`

---

## SDLC Workflow

All work happens on feature branches, goes through PR review, and merges only after CI passes.

```text
feat/<description>       # new features
fix/<description>        # bug fixes
chore/<description>      # non-code changes
security/<description>   # security patches
```

Commit format: `<type>(<scope>): <short description>` (e.g., `feat(feed): add location-based filtering`)

---

## Sprint History

| Sprint | Shipped |
| --- | --- |
| 25 | i18n system (10 locales: EN/ES/PT/FR/DE/JA/KO/TH/ID/TR), lazy-loaded dictionaries, useT() hook, auto-detection, html lang sync, language picker in Settings |
| 24 | Font shop (7 Google Fonts, 1 WLD each), perpetual polls, server-synced preferences, CodeQL fixes |
| 23 | Multi-entity search (boards + people + posts), World ID action cleanup, ESLint v9 migration |
| 22 | Public Developer API (posts, polls, boards, stats), API key management, post impressions |
| 21 | 40 boards + BoardPicker, live rooms in feed, voice-room style UI, share buttons, profile picture upload |
| 20 | Unit test suite (69 tests), open source (MIT), signout cookie hardening, SDLC workflow |
| 19 | Security audit (12 patches), Sentry integration, CI upgrade (Node 22), GitHub community files |
| 18 | Auth bypass fix, atomic votes, private Pusher channels, CSP hardening, account deletion cleanup |
| 17 | TipModal, ConversationView error states, PostComposer improvements, URL validation |
| 16 | Tip push notifications, rooms auto-close, karma in feed cards |
| 15 | Dynamic board system (synonym dedup + Levenshtein), PostComposer UX overhaul |
| 14 | ArkoraNullifierRegistry.sol, post content hashes (tamper evidence) |
| 13 | Onchain World ID verification via WorldIDRouter, verifiedBlockNumber |
| 12 | Health check, CI pipeline, OG metadata, auth rate limiting, account deletion, legal pages |
| 10-11 | Rooms Phase 1, sign-out persistence, vote reactions, repost, report auto-hide |
| 7-9 | Sybil-resistant polls, Karma/reputation, Confessions board |

---

## Remaining Work

- [ ] Brand assets (og-image, favicons, PWA icons) - blocks PWA install + social sharing
- [ ] Upgrade rate limiter to Upstash Redis
- [ ] Upgrade DB driver to `@neondatabase/serverless`
- [ ] Rooms Phase 2 - audio (WebRTC or LiveKit)
- [ ] Admin moderation queue for reports
- [ ] Playwright E2E tests
- [ ] Custom domain
