# CLAUDE.md - Arkora Project Context

This file is loaded automatically by Claude Code at the start of every session. It provides project architecture, conventions, and operational context.

**Live URL:** <https://arkora.app>
**Twitter:** [@humansposting](https://x.com/humansposting)
**Developer Portal:** <https://developer.worldcoin.org>

---

## Commands

```bash
pnpm dev              # Next.js dev server (Turbopack)
pnpm build            # Production build
pnpm lint             # ESLint
pnpm test             # Run all tests (82 Vitest unit tests)
pnpm db:push          # Push Drizzle schema to database
pnpm db:generate      # Generate Drizzle migrations
pnpm db:studio        # Open Drizzle Studio GUI
pnpm db:seed          # Seed database (reads .env.local)
```

---

## Tech Stack

- **Framework**: Next.js 15 App Router + Turbopack
- **Language**: TypeScript 5.6 strict mode (`noUncheckedIndexedAccess`, `noImplicitAny`, `noImplicitReturns`)
- **Styling**: Tailwind CSS 4 (CSS-first config via `@theme` in `globals.css`) + custom glass-morphism classes
- **State**: Zustand with localStorage persistence (`store/useArkoraStore.ts`)
- **Database**: Neon Postgres via Drizzle ORM (`lib/db/schema.ts`)
- **Real-time**: Pusher (server `lib/pusher.ts`, client `pusher-js`)
- **Auth**: World ID MiniKit (`@worldcoin/minikit-js`, `@worldcoin/minikit-react`) + IDKit v4 (`@worldcoin/idkit`) for desktop/mobile-browser
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

2. **World ID verification** - user-triggered. Mobile: MiniKit `verify` command. Desktop/mobile-browser: IDKit v4 `IDKitRequestWidget` with `orbLegacy()` preset (`hooks/useVerification.ts` + `components/auth/VerifyHuman.tsx`). Client fetches RP context from `GET /api/idkit/context` (server-side signing via `signRequest()`), then opens the widget. Sends proof to `POST /api/verify`.
   - **Engine: Onchain.** Proof validated via viem `readContract` against WorldIDRouter (`0x17B354dD2595411ff79041f930e491A4Df39A278`) on World Chain mainnet (chain 480). See `lib/worldid.ts`.
   - IDKit v4 uses `allow_legacy_proofs: true` with `orbLegacy()` preset to return v3-format proofs compatible with existing on-chain verification.
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

Rate limiter uses Upstash Redis when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are set (cross-instance enforcement). Falls back to in-memory when env vars are missing (dev/local). Both sync `rateLimit()` and async `rateLimitAsync()` APIs are available.

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
| `lib/agentAuth.ts` | `requireV2Auth()` + `requireAgentKitOnly()` for v2 routes |
| `lib/db/agentkit.ts` | DrizzleAgentKitStorage (nonce + usage tracking) |
| `lib/db/analytics.ts` | Sentiment, trends, demographics query builders |
| `lib/x402.ts` | x402 micropayment pricing config |
| `lib/i18n/en.ts` | English dictionary (source of truth for all TKey types) |
| `lib/i18n/index.ts` | Locale type, lazy dictionary loader, detectLocale() |
| `hooks/useT.ts` | `useT()` translation hook - returns `(key: TKey) => string` |
| `hooks/useVerification.ts` | World ID verify flow (MiniKit mobile + IDKit v4 desktop/mobile-browser) |
| `hooks/useFeed.ts` | Feed data fetching + pagination + cache |
| `hooks/useMentionAutocomplete.ts` | @mention detection + debounced autocomplete |
| `components/auth/SessionHydrator.tsx` | Hydrates Zustand from server on login (skins, fonts, preferences) |
| `components/providers/SkinProvider.tsx` | Applies skin CSS vars from Zustand |
| `components/providers/FontProvider.tsx` | Injects Google Fonts + sets --font-override CSS var |
| `components/settings/SkinShop.tsx` | Skin purchase + live preview before purchase |
| `components/settings/FontShop.tsx` | Font purchase + live preview before purchase |
| `components/settings/SettingsView.tsx` | Full settings page |
| `components/search/SearchSheet.tsx` | Multi-entity search modal |
| `app/api/idkit/context/route.ts` | Generates RP context (signRequest) for IDKit v4 widget |
| `next.config.ts` | CSP headers, HSTS, remotePatterns, Sentry config |

---

## Known Issues

- **Rate limiter** uses Upstash Redis in production (cross-instance). Falls back to in-memory when `UPSTASH_REDIS_REST_*` env vars are missing.
- **Neon 20-connection limit.** Pool max set to 5 with singleton client caching.
- **DM private key in localStorage.** Users lose DM history if they clear browser data. By design for MVP.
- **Country code** inferred from `x-vercel-ip-country` header. GPS optional, sent only when `locationEnabled=true`.
- **Brand assets** (`/og-image.png`, `/icon-192.png`, `/icon-512.png`, `/favicon.ico`, `/apple-touch-icon.png`) must be created - blocks PWA install and social sharing previews.
- **pnpm audit** - zero vulnerabilities. Patched via pnpm overrides: `minimatch >=10.2.3`, `fast-xml-parser >=5.5.6`, `flatted >=3.4.0`.

---

## Deployment Checklist

- [ ] `DATABASE_URL` (Neon, with SSL)
- [ ] `PUSHER_*` + `NEXT_PUBLIC_PUSHER_*` vars
- [ ] `HIPPIUS_*` vars
- [ ] `NEXT_PUBLIC_APP_ID` / `APP_ID` matching Developer Portal
- [ ] `NEXT_PUBLIC_ACTION_ID` matching Developer Portal action
- [ ] `WORLDCOIN_API_KEY` for World App push notifications
- [ ] `ADMIN_NULLIFIER_HASHES` for `/api/admin/metrics`
- [ ] `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` for cross-instance rate limiting
- [ ] `IDKIT_RP_ID` + `IDKIT_SIGNING_KEY` for IDKit v4 desktop/mobile-browser verification
- [x] `WORLD_ID_ROUTER=0x17B354dD2595411ff79041f930e491A4Df39A278`
- [x] `WORLD_CHAIN_RPC=https://worldchain-mainnet.g.alchemy.com/public`
- [x] `SENTRY_AUTH_TOKEN` + `NEXT_PUBLIC_SENTRY_DSN` in Vercel
- [ ] `AGENTKIT_APP_ID` for AgentBook registration (optional)
- [ ] `AGENTKIT_RPC_URL` for AgentBook lookups (optional, has default)
- [ ] `X402_PAYMENT_WALLET` for micropayment receipts (World Chain USDC)
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
| 29 | Hardening v2 - linked-identity gap closure: reply vote, follow, block, subscribe, tip endpoints now check all linked nullifiers (0x + wlt_) for self-action and double-vote prevention. Postgres error-code detection (23505) replaces fragile constraint-name string matching in tips/skins/fonts. Redundant NOT-EQUAL filter removed from deleteReplyVote/deletePostVote recount queries. Rate limit added to subscribe/list GET. |
| 28 | Security hardening (strip walletAddress/lat-lng/creatorWallet from public responses, rate limit health/postDetail/idkitContext, try/catch on dm/keys), dead code removal (verifyTransaction, contracts, ArkVotes.sol, form-data, 23 unused Db* types, unused exports), deps update (Next 16.2.0, idkit 4.0.10, sentry 10.44.0, pusher 5.3.3, pusher-js 8.4.2, drizzle-kit 0.31.10, CVE patches for fast-xml-parser + flatted), QA.md testing checklist, fix 0x-prefix cookie regex (unblocked desktop IDKit users) |
| 27 | AgentKit v2 API (dual auth: AgentKit proof-of-human + API key fallback), premium analytics endpoints (sentiment, trends, demographics) with x402 402 responses when free trial exhausted, DrizzleAgentKitStorage for nonce replay + usage tracking, spec-compliant x402 payment instructions (USDC on World Chain eip155:480), MCP server for AI agent tooling, 13 new tests (82 total) |
| 26 | Tailwind CSS v4 migration (CSS-first @theme config, color-mix opacity, autoprefixer removed), IDKit v4 migration (IDKitRequestWidget, orbLegacy preset, server-side RP context signing), eslint-config-next v16.2, dependency bumps (idkit, vercel/analytics, vercel/speed-insights, viem, zustand, framer-motion, Next 16.2.0) |
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

## v2 API + AgentKit

### Architecture

v2 API mirrors v1 endpoints with dual authentication:

1. **AgentKit auth** (primary) - AI agents prove they're delegated by a World ID-verified human. Header: `agentkit` or `x-agentkit`. Verified via `parseAgentkitHeader()` -> `validateAgentkitMessage()` -> `verifyAgentkitSignature()` -> `agentBook.lookupHuman()`.
2. **API key fallback** - same as v1, `X-API-Key` header.
3. **Neither** - returns 402 with AgentKit extension declaration.

Auth middleware: `requireV2Auth()` (dual) and `requirePremiumAuth()` (premium endpoints) in `lib/agentAuth.ts`.

### Rate Limits

| Endpoint | API Key | AgentKit |
| --- | --- | --- |
| v2/posts, polls | 120/min | 240/min |
| v2/boards | 60/min | 120/min |
| v2/stats | 30/min | 60/min |
| v2/sentiment, trends | blocked | 50/day free-trial, then 60/min |
| v2/demographics | blocked | 50/day free-trial, then 30/min |

### Premium Endpoints (AgentKit-only)

- `GET /api/v2/sentiment?boardId=X&window=24h|7d|30d` - sentiment score (0-1) + volume
- `GET /api/v2/trends?limit=10&window=24h` - trending boards by post velocity delta
- `GET /api/v2/demographics?boardId=X&window=7d` - vote distribution by country

Auth flow: `requirePremiumAuth(req, endpointKey)` in `lib/agentAuth.ts`:
1. No AgentKit header -> 402 with AgentKit extension declaration + x402 payment params
2. Valid AgentKit header, within 50/day free trial -> grant access, increment usage
3. Valid AgentKit header, free trial exhausted -> 402 with x402 payment params (USDC on World Chain)

### DB Tables

- `agentkit_usage` - per-human, per-endpoint usage tracking (free-trial daily quotas)
- `agentkit_nonces` - nonce replay protection

### x402 Micropayments

Pricing config in `lib/x402.ts`. When free-trial quota exhausted, 402 response includes x402 payment parameters (USDC on World Chain).

### MCP Server

Standalone server in `mcp/` directory. Exposes Arkora data as MCP tools:
- `arkora_search_posts`, `arkora_get_poll_results`, `arkora_get_sentiment`, `arkora_get_trends`, `arkora_get_stats`

Run: `cd mcp && npx tsx index.ts` (stdio) or `npx tsx index.ts --sse` (SSE on port 3001).

### New Environment Variables

```
AGENTKIT_APP_ID          - World ID app ID (reference only - server does not use this directly;
                           agents use it when registering delegation in AgentBook)
AGENTKIT_RPC_URL         - RPC for AgentBook lookups (optional, has default)
X402_PAYMENT_WALLET      - Wallet to receive micropayments (World Chain USDC)
X402_PRICE_SENTIMENT     - Override default $0.001/req
X402_PRICE_TRENDS        - Override default $0.001/req
X402_PRICE_DEMOGRAPHICS  - Override default $0.002/req
ARKORA_API_URL           - MCP server target (default: http://localhost:3000)
ARKORA_API_KEY           - MCP server API key
MCP_PORT                 - MCP SSE port (default: 3001)
```

### Key Files

| File | Purpose |
| --- | --- |
| `lib/agentAuth.ts` | Dual auth middleware (AgentKit + API key fallback) |
| `lib/db/agentkit.ts` | DrizzleAgentKitStorage (nonce + usage tracking) |
| `lib/db/analytics.ts` | Shared analytics query builders (sentiment, trends, demographics) |
| `lib/x402.ts` | x402 micropayment pricing config |
| `app/api/v2/posts/route.ts` | v2 posts (dual auth) |
| `app/api/v2/polls/route.ts` | v2 polls (dual auth) |
| `app/api/v2/boards/route.ts` | v2 boards (dual auth) |
| `app/api/v2/stats/route.ts` | v2 stats (dual auth) |
| `app/api/v2/sentiment/route.ts` | Sentiment aggregation (AgentKit-only) |
| `app/api/v2/trends/route.ts` | Trending topics (AgentKit-only) |
| `app/api/v2/demographics/route.ts` | Geographic demographics (AgentKit-only) |
| `mcp/index.ts` | MCP server entry (stdio + SSE) |
| `mcp/tools.ts` | MCP tool definitions |

---

## Remaining Work

- [ ] Brand assets (og-image, favicons, PWA icons) - blocks PWA install + social sharing
- [x] Upgrade rate limiter to Upstash Redis (with in-memory fallback)
- [x] v2 API with AgentKit auth + premium analytics + MCP server
- [x] Security audit + hardening (Sprint 28)
- [x] Dead code cleanup + dependency audit (Sprint 28)
- [ ] Upgrade DB driver to `@neondatabase/serverless`
- [ ] Rooms Phase 2 - audio (WebRTC or LiveKit)
- [ ] Admin moderation queue for reports
- [ ] Playwright E2E tests
- [ ] Custom domain
- [ ] eslint 10 upgrade (blocked by eslint-plugin-react compatibility)
- [ ] Migrate sync `rateLimit()` to `rateLimitAsync()` on internal endpoints
- [ ] On-chain purchase transaction verification
