# Contributing to Arkora

Thank you for your interest in contributing. This document covers development setup, conventions, and the contribution process.

## Development Setup

### Prerequisites

- Node.js 22 (see `.nvmrc`)
- pnpm 9+
- A Neon Postgres database
- A Pusher account
- World ID app credentials

### Local Setup

```bash
git clone https://github.com/hetark/arkora
cd arkora
pnpm install
cp .env.example .env.local   # fill in required values (see below)
pnpm dev
```

### Required Environment Variables

```
DATABASE_URL=            # Neon Postgres connection string
PUSHER_APP_ID=
PUSHER_KEY=
PUSHER_SECRET=
PUSHER_CLUSTER=
NEXT_PUBLIC_PUSHER_KEY=
NEXT_PUBLIC_PUSHER_CLUSTER=
WORLDCOIN_API_KEY=
NEXT_PUBLIC_WORLD_APP_ID=
HIPPIUS_ACCESS_KEY_ID=   # optional — only for image uploads
HIPPIUS_SECRET_ACCESS_KEY=
SENTRY_AUTH_TOKEN=       # optional — only required for production source map uploads
```

## Project Architecture

The project uses Next.js 15 App Router with TypeScript strict mode. Key patterns are documented in [CLAUDE.md](./CLAUDE.md). Short version:

- **API routes**: `validate → getCallerNullifier() → rateLimit → business logic → JSON`
- **Auth**: identity comes from the `arkora-nh` httpOnly cookie via `getCallerNullifier()` — never trust request body for identity
- **DB**: Drizzle ORM with Neon Postgres — all queries are parameterized (no raw SQL string interpolation)
- **Realtime**: Pusher presence channels for rooms, private channels for DMs and notifications
- **Imports**: always use `@/` path alias

## Branch Naming

| Prefix | Purpose |
| ------ | ------- |
| `feat/` | New feature |
| `fix/` | Bug fix |
| `ui/` | Visual / styling changes |
| `chore/` | Tooling, deps, refactors |
| `docs/` | Documentation only |
| `security/` | Security patches |

Examples: `feat/polls-leaderboard`, `fix/dm-send-failure`, `ui/dark-mode-tokens`

## Commit Messages

Use the imperative mood. Focus on *what* and *why*, not *how*.

```
feat(rooms): add presence indicators to member list

Shows who is currently online in a room. Uses Pusher presence
channel membership count to avoid additional DB queries.
```

Scope is optional but helpful: `feat(rooms)`, `fix(dm)`, `chore(deps)`, `security(auth)`.

## Pull Request Process

1. Branch from `main`
2. Keep PRs focused — one logical change per PR
3. Run `pnpm test`, `pnpm exec tsc --noEmit`, and `pnpm exec next lint` locally — CI will catch failures
4. Fill out the PR template completely
5. Request review from @hetark

CI checks that must pass:

- Tests: 69 unit tests passing (`pnpm test`)
- TypeScript: zero errors (`tsc --noEmit`)
- ESLint: zero warnings (`next lint`)
- Build: `next build` succeeds

## Code Style

- **TypeScript strict** — all strict flags enabled, including `noUncheckedIndexedAccess`
- **Tailwind** — utility classes only; no custom CSS unless unavoidable
- **No raw `console.log`** in production paths — use tagged `console.error('[component]', ...)` for error paths
- **Sanitize before DB writes** — use `sanitizeLine()` / `sanitizeText()` from `@/lib/sanitize`
- **No secret in code** — all credentials via environment variables

## Security

Please review our [Security Policy](./SECURITY.md) before reporting any vulnerabilities. Do not open public issues for security findings.

## Questions

Open a discussion or reach out via the issue tracker for questions about architecture, patterns, or planned changes before starting large pieces of work.
