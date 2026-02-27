# Arkora - Full Tech Stack Explainer

> Written to be read aloud. Conversational, analogy-heavy, no assumed prior knowledge.
> Each section builds on the last. Read from top to bottom for the full picture.

---

## What Is Arkora?

Arkora is a message board — like Reddit, but with one rule that changes everything: every single post comes from a verified human. Not a bot. Not a fake account. A real, biologically-verified person.

Think of it like a town square where the bouncer at the door checks your ID with an iris scanner before letting you post. Once you're in, you're anonymous — no one knows who you are — but everyone knows you're real.

That one guarantee — every post is human — is the entire product. Everything else (the boards, the DMs, the polls, the rooms) is built on top of that foundation.

---

## The Problem It Solves

The internet is flooded with bots. Studies suggest 40-70% of social media activity is automated. Polls are gamed. Trending topics are manufactured. Public opinion is simulated.

Arkora flips this: every post, vote, and reaction is guaranteed to come from one real human being. You cannot fake it. You cannot buy followers. You cannot run a bot farm. The proof is onchain.

This is not just a UX feature. It is a new category of data: verified-human signal.

---

## Layer 1 - The Front End (What You See)

**Technology: Next.js 15, React 18, TypeScript, Tailwind CSS**

Next.js is the framework. Think of it as the engine under the hood of a car - it handles routing (which page shows up when you tap something), server rendering (so the page loads fast instead of flickering), and API routes (the back-end logic lives in the same codebase).

React is what the UI is built with. React thinks of every part of the screen as a "component" - a reusable piece. The post card, the reply box, the nav bar - each is a component. React keeps the screen in sync with the data automatically.

TypeScript is like React with a spell-checker and grammar checker built in. It catches bugs before the app ever runs. If a function expects a number and someone passes a word, TypeScript yells at compile time, not at 2am when a user finds it.

Tailwind CSS is the styling system. Instead of writing separate CSS files, you apply tiny utility classes directly in the HTML (`text-white`, `rounded-xl`, `flex`). Faster to write, easier to maintain.

The visual style is **liquid glass** - translucent panels with blur behind them, like frosted glass on a dark surface. This is inspired by Apple's iOS 26 design language.

---

## Layer 2 - State Management (The App's Short-Term Memory)

**Technology: Zustand**

When you're using the app, it needs to remember things: are you logged in? what board are you on? have you read this notification? This is called "state."

Zustand is the library that manages this in-memory state on the client. Think of it like a whiteboard in the room - anyone in the app can read it or write to it instantly. It persists to localStorage so the app remembers you between sessions.

When you tap "like" on a post, Zustand updates the like count immediately on screen (optimistic update) before the server even responds. This makes the app feel instant.

---

## Layer 3 - The Database (Permanent Storage)

**Technology: Neon Postgres, Drizzle ORM**

The database is where everything permanent lives: users, posts, replies, votes, DMs, follows. It's a Postgres database (the gold-standard SQL database, used by companies like Instagram and Notion) hosted on Neon, which is a serverless cloud Postgres provider.

"Serverless" means the database scales to zero when no one is using it and spins up instantly when someone is. You only pay for what you use. This is ideal for an early-stage app where traffic is unpredictable.

**Drizzle ORM** is the translator between TypeScript code and raw SQL. Instead of writing `SELECT * FROM posts WHERE board = 'tech'`, you write `db.select().from(posts).where(eq(posts.board, 'tech'))`. It's type-safe, meaning the database schema and the TypeScript types stay in sync automatically.

---

## Layer 4 - The Identity Layer (Who You Are)

**Technology: World ID, MiniKit, IDKit**

This is the core of Arkora.

**World ID** is a privacy-preserving proof of personhood built by Worldcoin (Tools for Humanity). To get a World ID, you scan your iris at a physical Orb device. The Orb confirms you're a real human and generates a cryptographic credential. No photos or biometric data are stored - only a cryptographic hash.

**Zero-knowledge proof** is the magic here. When you verify on Arkora, you don't show your World ID credential. You generate a ZK proof - a mathematical statement that says "I have a valid World ID and I haven't used it on this app before" - without revealing the credential itself. It's like proving you're over 21 without showing your birthday.

**MiniKit** is the SDK (software development kit) for World App. When Arkora runs inside World App (a WebView), MiniKit intercepts wallet and verification commands and routes them to the app natively. This is how "verify" works with one tap inside World App.

**IDKit** is the fallback for desktop or mobile browser users outside World App. It shows a QR code you scan with World App to complete verification.

The result is a `nullifier hash` - a unique identifier for your World ID on Arkora specifically. The same person always gets the same nullifier hash on Arkora, but a completely different one on any other app. This is how the system knows you haven't verified twice, without knowing who you are.

---

## Layer 5 - Blockchain Verification (The Trustless Proof)

**Technology: World Chain, viem, WorldIDRouter smart contract**

When you verify your World ID on Arkora, the proof isn't checked by Worldcoin's servers. It's verified directly against a smart contract on World Chain.

**World Chain** is an Ethereum-compatible blockchain (chain ID 480) built specifically for World ID. Think of a smart contract as a vending machine bolted to the blockchain - you put in a proof, it checks it, it spits out true or false. No company in the middle. No server that can lie or go down.

The specific contract is `WorldIDRouter` at address `0x17B354dD2595411ff79041f930e491A4Df39A278`. Arkora calls its `verifyProof()` function directly.

**viem** is the TypeScript library for talking to blockchains. Think of it as the phone line between the app and the World Chain blockchain.

When verification succeeds, the current block number is recorded in the database. You can look up your verification on Worldscan (the World Chain block explorer) and prove it happened - without trusting Arkora's word for it.

---

## Layer 6 - SIWE Wallet Authentication (The Session)

**Technology: Sign-In With Ethereum (SIWE), MiniKit walletAuth**

After verifying your humanity, you still need a login session - like a hotel key card. This is handled with SIWE.

When you open Arkora in World App, it silently asks your wallet to sign a nonce (a one-time random string). Signing a nonce with your private key proves you control that wallet address, without sending any money or revealing any secrets. It's like signing your name on a check - proves identity.

The signed payload goes to Arkora's server, which verifies the signature using cryptographic math. If valid, it sets a secure HTTP-only cookie. From that point on, every request is authenticated.

Your wallet address is never shown publicly. It's stored server-side only for session management.

---

## Layer 7 - Real-Time Features (Live Updates)

**Technology: Pusher (WebSockets)**

When someone replies to your post, you shouldn't have to refresh the page to see it. Real-time updates are handled by Pusher.

Pusher is a managed WebSocket service. Think of WebSockets as a phone call (open persistent connection) versus HTTP requests (a text message - you send, wait, receive, connection closes). When you're on Arkora, your browser maintains an open WebSocket connection to Pusher.

When someone replies to you, Arkora's server sends an event to Pusher, which instantly pushes it to your browser. The notification counter ticks up live. Messages in DMs appear instantly. Rooms update in real time.

DM channels are private (prefixed `private-user-*`) and require server-side authentication before Pusher will deliver messages to them. This prevents anyone from snooping on your notifications.

---

## Layer 8 - Encrypted Direct Messages

**Technology: X25519 ECDH, HKDF-SHA256, AES-256-GCM (`@noble/curves`, `@noble/hashes`)**

DMs are end-to-end encrypted. Not even Arkora's servers can read them.

When you first open DMs, your browser generates a key pair: a public key (you share this) and a private key (never leaves your device). The public key is stored on Arkora's server.

When Alice DMs Bob:
1. Alice fetches Bob's public key from the server
2. Alice's private key + Bob's public key → shared secret (X25519 ECDH - a mathematical operation that produces the same output for both parties without ever transmitting the secret)
3. That shared secret → encryption key (HKDF-SHA256 key derivation)
4. Alice's message is encrypted with AES-256-GCM (military-grade symmetric encryption)
5. The encrypted ciphertext is sent to the server and relayed to Bob
6. Bob reverses the process with his private key

The server only ever sees ciphertext. If Arkora's database is breached, DMs are unreadable.

---

## Layer 9 - File Storage (Decentralized)

**Technology: Hippius S3 (Bittensor Subnet 14)**

Profile pictures and media uploads are stored on Hippius - a decentralized storage network built on Bittensor Subnet 14.

Think of Bittensor as a marketplace for AI compute. Subnet 14 specifically runs decentralized storage. Instead of storing files on a centralized server (like AWS S3, which Amazon can take down), files are distributed across a network of independent nodes. No single point of failure. No single party who can delete your content.

The API is S3-compatible, so it works exactly like Amazon S3 from the code's perspective. Just a different endpoint.

This is part of the long-term vision: Arkora's identity is on World Chain (decentralized), storage is on Bittensor (decentralized), compute/hosting is next.

---

## Layer 10 - The API Layer (Server-Side Logic)

**Technology: Next.js App Router API Routes**

Every action (post, vote, follow, send DM) hits an API route on the server. These are TypeScript functions that run server-side (not in the browser).

Every route follows the same pattern:
1. **Parse and sanitize input** - strip dangerous characters, normalize Unicode
2. **Authenticate caller** - read the nullifier hash from the encrypted cookie
3. **Rate limit** - prevent spam and abuse
4. **Business logic** - write to the database
5. **Return JSON** - `{ success: true, data: ... }` or `{ success: false, error: ... }`

Rate limiting uses an in-memory sliding window. The key is always the user's nullifier hash (not their IP), so VPNs and shared IPs don't affect legitimate users.

---

## Layer 11 - Monitoring and Error Tracking

**Technology: Sentry, Vercel Analytics, Vercel Speed Insights**

Sentry captures every unhandled error in production - both server-side and client-side. When something breaks, it shows the exact file, line number, and stack trace. PII (personal data) is explicitly disabled.

Vercel Analytics tracks page views and unique visitors. Speed Insights tracks Core Web Vitals (how fast pages load, how long before they're interactive). Both are privacy-first - no cookies, no tracking pixels.

---

## Layer 12 - Deployment and CI/CD

**Technology: Vercel, GitHub Actions**

Vercel deploys the app. Every PR gets an automatic preview URL for testing. Merging to `main` deploys to production automatically. Zero-config, zero ops.

GitHub Actions runs CI on every PR:
1. Install dependencies
2. Run 69 unit tests (`pnpm test`)
3. ESLint checks
4. TypeScript type check
5. Production build (catches build-time errors)

If any step fails, the PR cannot be merged. This catches bugs before they reach production.

---

## The Moat

Here is why this is hard to copy:

**1. The data flywheel.** Every verified human who posts on Arkora adds to a dataset that gets more valuable as it grows. Verified-human opinion data is genuinely rare. Bots cannot contaminate it. AI companies pay for this kind of clean signal data.

**2. Distribution through World App.** World App has millions of verified users. Being listed in the World App mini app store means Arkora can acquire users at near-zero cost through organic discovery. A competitor without this channel has to build their own distribution.

**3. The verification UX.** Arkora is one of the first apps to do fully onchain World ID verification (not cloud API). This is more trustless, more censorship-resistant, and technically superior. It's also more complex to replicate.

**4. The platform lock-in.** Karma scores, posts, followers, DMs - these are social graph assets that don't transfer. Once a community forms, the switching cost gets high.

---

## The Data Product (The Real Long-Term Play)

Arkora is sitting on a dataset that doesn't exist anywhere else: verified-human opinions, posts, and poll responses - all provably bot-free.

AI companies doing RLHF (Reinforcement Learning from Human Feedback) - the technique used to train models like ChatGPT to be helpful - desperately need clean human data. Most "human feedback" datasets are contaminated with bots, paid click farms, or low-quality responses.

Arkora's data has a cryptographic guarantee of humanity. This is worth real money as an API product:
- AI labs pay to use it for training data
- Brands pay for verified-human sentiment on their products
- Political and academic researchers pay for bot-free polling data

This is the Sprint 21 play: expose the data as a queryable API (REST first, MCP protocol second). Charge per query. This is the revenue model.

---

## The Grants Landscape

**Developer Rewards Pilot (NOW)**
- $100K/week pool split among top mini apps by verified-human usage
- Automatic. Launch → get users → collect weekly rewards in WLD
- No application. Just be listed in the mini app store and have users.

**Spark Track Grant (pre-launch)**
- For early-stage builders turning ideas into working mini apps
- Apply at docs.world.org
- Amount not publicly disclosed but accessible to indie builders

**Scale Track Grant (post-launch with traction)**
- For live mini apps with real verified human users
- More capital, requires demonstrated traction

**Retroactive $1M Program**
- For apps that reach 10,000 unique verified humans
- Automatic eligibility once threshold is hit

**Build With World (periodic)**
- Competitive. Top 10 finalists get $25K WLD equivalent

---

## What Fundable Looks Like From Here

The code is production-quality. The tech is real. What's needed now:

1. **Launch and get users.** Everything else is noise until there are real humans using this.
2. **Metrics that tell a story.** DAU, MAU, posts per day, verified humans count. The admin dashboard already exists at `/api/admin/metrics`.
3. **The data API.** One paying customer for the data product (an AI company or research institution) is worth more to a pitch deck than 1,000 users.
4. **The attestation layer.** EAS (Ethereum Attestation Service) on World Chain + Arweave permanent storage makes posts censorship-resistant and immutable. This is the story of "we're not just another social network."
5. **A 10-slide pitch deck.** Problem, solution, why now, moat, traction, revenue model, market size, team, roadmap, ask.

The story is simple and fundable: "We built the only provably-human social platform. The data it generates is the most valuable AI training signal that doesn't currently exist at scale."
