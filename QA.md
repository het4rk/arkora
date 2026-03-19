# QA Testing Checklist

Manual testing checklist for Arkora. Run through before every production deploy.

## Auth Flow

- [ ] **Onboarding** - Fresh user sees onboarding screen, can proceed
- [ ] **WalletConnect (World App)** - Opens World App, signs SIWE, gets session cookie, Zustand hydrates
- [ ] **World ID verify (MiniKit)** - Inside World App: MiniKit verify command opens, proof submits, `isVerified` set
- [ ] **World ID verify (IDKit desktop)** - Desktop browser: IDKit widget opens, QR code scans, proof submits, session persists across reload
- [ ] **World ID verify (IDKit mobile browser)** - Mobile Safari/Chrome: IDKit widget works, redirects back, session persists
- [ ] **Session persistence** - Reload page after verify, still authenticated (SessionHydrator validates cookie)
- [ ] **Sign out** - Clears cookies, Zustand state, redirects to onboarding
- [ ] **Cookie validation** - 0x-prefixed nullifiers accepted (desktop IDKit users)
- [ ] **Already verified** - Re-verifying restores session from DB, does not create duplicate user

## Feed

- [ ] **Curated feed** - Hot-ranked posts load, scroll pagination works
- [ ] **Following feed** - Shows posts from followed users only (requires auth)
- [ ] **Local feed** - Country-scoped posts appear based on IP geolocation
- [ ] **Board filter** - Selecting a board filters the feed correctly
- [ ] **Empty states** - Following feed with no follows shows empty state
- [ ] **Pull to refresh** - Feed refreshes on pull (mobile)

## Posts

- [ ] **Create text post** - Title + body, appears in feed immediately
- [ ] **Create poll** - Options render, can set duration (24h/3d/7d/perpetual)
- [ ] **Vote on poll** - Vote registers, percentages update, can't vote twice (sybil-resistant)
- [ ] **Upvote/downvote** - Vote buttons work, optimistic UI, can toggle/change vote
- [ ] **Repost** - Creates a repost, shows quoted post inline
- [ ] **Delete own post** - Post disappears from feed, confirmed via dialog
- [ ] **Image upload** - Attach image, preview shows, uploads to Hippius, renders in feed
- [ ] **Hashtags** - #tags parsed from body, appear as clickable links
- [ ] **@mentions** - Autocomplete shows, mention creates notification for target
- [ ] **Board assignment** - Typing a new board name normalizes it, synonym dedup works
- [ ] **Confessions board** - Force-anonymous, identity hidden regardless of settings

## Replies

- [ ] **Reply to post** - Reply appears in thread, reply count increments
- [ ] **Nested replies** - Reply to a reply creates threaded view
- [ ] **Image in reply** - Image attachment works in replies
- [ ] **Upvote/downvote reply** - Vote buttons work on replies

## Identity

- [ ] **Anonymous mode** - Fresh `Human #XXXX` tag on each post
- [ ] **Alias mode** - Persistent handle shown on posts, editable in settings
- [ ] **Named mode** - World ID username shown on posts
- [ ] **Switch modes** - Changing identity mode in settings reflects on new posts

## Profile

- [ ] **Own profile** - Shows posts, karma, verification status, edit button
- [ ] **Other user profile** - Shows public data, follow button, **no wallet address visible**
- [ ] **Edit bio** - Bio updates, persists across reload
- [ ] **Edit avatar** - Upload works, appears on profile and in feed
- [ ] **Karma display** - Karma tier and score shown correctly
- [ ] **Verified block number** - Block number shown with worldscan link

## DMs

- [ ] **Register DM key** - Key pair generated on first DM open
- [ ] **Send DM** - Message encrypted, appears for recipient
- [ ] **Receive DM** - Push notification, message decrypts correctly
- [ ] **Block user** - Blocked user can't send DMs, existing thread hidden
- [ ] **DM list** - Conversations sorted by most recent

## Rooms

- [ ] **Create room** - Title, board, duration set, room goes live
- [ ] **Join room** - Participant appears in grid, message input enabled
- [ ] **Send message** - Real-time delivery via Pusher
- [ ] **Leave room** - Participant removed from grid
- [ ] **Room expires** - Auto-closes after duration, marked as ended

## Notifications

- [ ] **Reply notification** - Received when someone replies to your post
- [ ] **Follow notification** - Received when someone follows you
- [ ] **DM notification** - Received on new DM
- [ ] **Mention notification** - Received when @mentioned
- [ ] **Mark read** - Notification badge clears on view
- [ ] **Push notifications** - World App native push works (replies, DMs, follows, tips)

## Monetization

- [ ] **Tip user** - TipModal opens, amount selectable, WLD transaction submits
- [ ] **Subscribe** - Subscription modal, payment, active status shown on profile
- [ ] **Skin shop** - Preview works, purchase completes, skin applies
- [ ] **Font shop** - Preview works, purchase completes, font applies

## Search

- [ ] **Board search** - Boards appear with post counts, prefix matching
- [ ] **People search** - Users appear with handles, prefix matching
- [ ] **Post search** - Posts appear with body preview

## Settings

- [ ] **Theme toggle** - Dark/light switches, persists
- [ ] **Language picker** - All 10 locales available, strings change
- [ ] **Notification toggles** - Replies, DMs, follows, followed posts toggleable
- [ ] **Location toggle** - Enable/disable, radius slider works
- [ ] **Developer API** - Generate key, copy shown once, revoke works
- [ ] **Account deletion** - Confirms dialog, deletes all data, signs out

## Public API (v1)

- [ ] `GET /api/v1/posts` - Returns posts with API key, pagination works
- [ ] `GET /api/v1/polls` - Returns polls with vote counts
- [ ] `GET /api/v1/boards` - Returns boards with post counts
- [ ] `GET /api/v1/stats` - Returns aggregate stats
- [ ] **401 without key** - Missing API key returns 401
- [ ] **403 with revoked key** - Revoked key returns 403
- [ ] **429 rate limit** - Exceeding 120/min returns 429
- [ ] **No private data** - Responses contain no nullifierHash, walletAddress, lat, lng

## Public API (v2)

- [ ] `GET /api/v2/posts` - Returns posts with API key (120/min) or AgentKit (240/min)
- [ ] `GET /api/v2/polls` - Same dual auth
- [ ] `GET /api/v2/boards` - Same dual auth
- [ ] `GET /api/v2/stats` - Same dual auth
- [ ] `GET /api/v2/sentiment` - AgentKit-only, returns sentiment score
- [ ] `GET /api/v2/trends` - AgentKit-only, returns trending boards
- [ ] `GET /api/v2/demographics` - AgentKit-only, returns country breakdown
- [ ] **402 without auth** - Returns AgentKit extension declaration + x402 payment params
- [ ] **402 after free trial** - 50/day limit returns 402 with x402 instructions
- [ ] **No private data** - Same as v1

## Security

- [ ] **No lat/lng in responses** - Feed posts never include coordinates
- [ ] **No walletAddress in profiles** - /api/u/[id] strips walletAddress
- [ ] **Rate limits active** - All endpoints enforce rate limits
- [ ] **CSP headers** - Response headers include Content-Security-Policy
- [ ] **HSTS** - Strict-Transport-Security header present
- [ ] **httpOnly cookies** - Session cookies not readable by JavaScript

## Performance

- [ ] **Feed loads under 2s** - First meaningful paint on feed page
- [ ] **No N+1 queries** - Feed, polls, profiles use batch queries
- [ ] **Images lazy load** - Below-fold images don't block initial render
- [ ] **Build size** - `pnpm build` completes, no unexpected bundle growth
