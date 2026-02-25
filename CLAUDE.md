# CLAUDE.md — Arkora

Provably-human anonymous message board built as a World App Mini App.
Users verify with World ID Orb, then post/vote/DM across themed boards.

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

## Tech stack

- **Framework**: Next.js 15 (App Router, Turbopack)
- **Language**: TypeScript 5.6, strict mode (`noUncheckedIndexedAccess`, `noImplicitAny`, `noImplicitReturns`)
- **Styling**: Tailwind CSS 3 + custom glass-morphism classes in `globals.css`
- **State**: Zustand with localStorage persistence (`store/useArkoraStore.ts`)
- **Database**: PostgreSQL via Drizzle ORM (`lib/db/schema.ts`)
- **Real-time**: Pusher (server `pusher`, client `pusher-js`)
- **Auth**: World ID MiniKit (`@worldcoin/minikit-js`, `@worldcoin/minikit-react`)
- **Blockchain**: viem on World Chain Sepolia (ArkVotes.sol contract)
- **Crypto**: `@noble/curves` (Curve25519 ECDH), `@noble/hashes` (HKDF-SHA256), Web Crypto (AES-256-GCM)
- **Package manager**: pnpm

## Project structure

```
app/                    # Next.js App Router
  api/                  # API routes (26 endpoints)
  boards/ dm/ notifications/ post/ profile/ settings/ u/
components/             # React components by feature
  auth/ compose/ dm/ feed/ notifications/ onboarding/
  profile/ providers/ search/ settings/ thread/ ui/
hooks/                  # Custom hooks (useFeed, useVote, useTip, etc.)
store/                  # Zustand store (useArkoraStore.ts)
lib/
  db/                   # Drizzle schema + one file per entity
    schema.ts           # All table definitions
    posts.ts users.ts votes.ts replies.ts dm.ts follows.ts
    notifications.ts subscriptions.ts tips.ts bookmarks.ts
    communityNotes.ts search.ts notes.ts
  crypto/dm.ts          # E2E encryption (Curve25519 + AES-256-GCM)
  cache.ts              # unstable_cache wrapper (15s revalidation)
  rateLimit.ts          # In-memory sliding-window rate limiter
  serverAuth.ts         # getCallerNullifier() — reads auth cookie
  session.ts            # Session tags + deterministic aliases
  types.ts              # Shared types (BoardId, Post, ApiResponse, etc.)
  chain.ts contracts.ts # World Chain + ArkVotes contract config
  pusher.ts             # Pusher server instance
  storage/              # File upload adapters (Hippius, local, S3)
  worldid.ts            # World ID verification helpers
contracts/              # Solidity (ArkVotes.sol)
scripts/                # seed.ts, migrate-board.ts
```

## Code conventions

- **Imports**: Always use the `@/` path alias (e.g. `import { Post } from '@/lib/types'`)
- **Components**: PascalCase filenames, functional components only. Client components must have `'use client'` directive.
- **Utilities/hooks**: camelCase filenames
- **API responses**: All routes return `ApiResponse<T>` — `{ success: true, data: T }` or `{ success: false, error: string }`
- **API routes**: Use `NextRequest`/`NextResponse` from `next/server`. Pattern: validate input -> check auth -> rate limit -> business logic -> return JSON.
- **Auth on server**: Call `getCallerNullifier()` from `@/lib/serverAuth` to get the caller's identity from the httpOnly `arkora-nh` cookie. Never trust nullifierHash sent in request body for auth.
- **Database**: Add new tables in `lib/db/schema.ts`, add query functions in a dedicated file under `lib/db/`. Use Drizzle's query builder, not raw SQL.
- **Types**: Define shared types in `lib/types.ts`. Use `interface` for object shapes. Use explicit optional with `| undefined` (required by `exactOptionalPropertyTypes`).
- **No `any`**: TypeScript strict mode is enforced. Use proper types or `unknown`.

## Architecture notes

- **Auth flow**: World ID Orb verification + MiniKit wallet sign-in set an httpOnly cookie (`arkora-nh`) containing the user's nullifier hash. All protected endpoints read this cookie via `getCallerNullifier()`.
- **Identity modes**: Users can be anonymous (random "Human #XXXX" per post), alias (deterministic adjective.noun from nullifier hash), or named (custom handle).
- **Voting**: Off-chain votes stored in `postVotes`/`replyVotes` tables for fast reads; on-chain mirror via ArkVotes.sol on World Chain Sepolia is the source of truth.
- **DMs are E2E encrypted**: Curve25519 ECDH key exchange, HKDF-SHA256 key derivation, AES-256-GCM encryption. Server only stores ciphertext. All crypto happens client-side in `lib/crypto/dm.ts`. Never decrypt on server.
- **Real-time**: Pusher channels scoped per user (`user-{nullifierHash}`) for DMs and notification counts.
- **Rate limiting**: In-memory sliding window (`lib/rateLimit.ts`). Per-instance only (serverless). Limits: posts 5/min, votes 60/min, DMs 30/min, tips 10/min, subscriptions 5/min.
- **Caching**: Feed queries wrapped in `unstable_cache` with 15s revalidation and tag-based invalidation (`invalidatePosts()`).
- **Boards**: `BoardId = 'arkora' | 'technology' | 'markets' | 'politics' | 'worldchain'` — defined in `lib/types.ts`.

## Environment variables

See `.env.example`. Required:

- `DATABASE_URL` — PostgreSQL connection string
- `NEXTAUTH_SECRET` — session signing secret
- `APP_ID` / `NEXT_PUBLIC_APP_ID` — World ID app ID
- `NEXT_PUBLIC_ACTION_ID` — World ID action identifier
- `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER` — Pusher server keys
- `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER` — Pusher client keys
- `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_WC_RPC` — World Chain config
