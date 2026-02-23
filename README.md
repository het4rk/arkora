# Arkora

A provably human anonymous message board built as a World App Mini App. Every post is from a World ID Orb-verified unique human. TikTok scroll feed, 4chan anonymity, Reddit structure — every voice cryptographically guaranteed real.

## Stack

- **Frontend:** Next.js 15 App Router, TypeScript strict, Tailwind CSS, Framer Motion, Zustand
- **Auth:** MiniKit walletAuth (SIWE) + World ID Orb verification
- **DB:** Neon Postgres + Drizzle ORM (repository pattern, Hippius-ready)
- **Chain:** World Chain Sepolia — ArkVotes.sol (one vote per nullifier per post)
- **Hosting:** Vercel

## Quick Start

```bash
pnpm install

# Fill in .env.local (copy from .env.example)
cp .env.example .env.local

# Push schema to DB
pnpm db:push

# Seed test data
DATABASE_URL="your_url" pnpm exec tsx scripts/seed.ts

# Dev server
pnpm dev
```

## Required env vars

| Variable | Source |
|---|---|
| `DATABASE_URL` | Neon dashboard |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NEXT_PUBLIC_ARK_VOTES_ADDRESS` | After contract deploy |

## World App Testing (ngrok)

```bash
ngrok http --url=bluecoated-patriarchical-jeffie.ngrok-free.dev 3000
```

Then open `https://bluecoated-patriarchical-jeffie.ngrok-free.dev` in World App simulator.

## Contract Deploy (World Chain Sepolia)

```bash
forge create contracts/ArkVotes.sol:ArkVotes \
  --rpc-url https://worldchain-sepolia.g.alchemy.com/public \
  --private-key YOUR_PRIVATE_KEY \
  --broadcast
```

Set the deployed address as `NEXT_PUBLIC_ARK_VOTES_ADDRESS`.

## License

MIT
