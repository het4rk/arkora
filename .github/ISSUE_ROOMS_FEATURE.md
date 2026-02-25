# feat: Live Rooms — real-time topic-based discussion spaces

**Labels:** `enhancement`

---

## Summary

Build a **Rooms** feature — live, real-time discussion spaces where verified humans can join and talk about a specific topic. Think X Spaces meets Discord channels, but for Arkora's provably-human anonymous platform.

## Motivation

Currently Arkora has posts, replies, and DMs. There's no way for a group of people to have a live, flowing conversation around a topic. Rooms would fill this gap and significantly increase engagement and time-in-app.

## Key Design Decisions

These need to be researched and resolved before implementation:

### 1. Audio, text, or both?
- **Text-only** — simplest to build, can leverage existing Pusher infrastructure
- **Audio-first** — like X Spaces, more engaging but requires WebRTC/media servers (LiveKit, 100ms, Agora)
- **Both** — Discord model, text chat alongside optional audio

### 2. Ephemeral or persistent?
- **Ephemeral** — rooms disappear after they end (like X Spaces). Aligns with Arkora's anonymous identity model — conversations that exist in the moment.
- **Persistent** — rooms/channels stick around (like Discord). Better for community building but requires more moderation.

### 3. Identity in rooms
- Does the anonymous/alias/named mode carry over from posts?
- Can a room host see who's speaking (even if anonymous to others)?
- Should room participation be visible on profiles?

### 4. Moderation
- Real-time moderation: mute, kick, ban from room
- Extend existing report system to cover room participants
- Auto-moderation for text chat (toxicity filtering)
- Host/co-host privileges

### 5. Infrastructure cost
- **Text via Pusher** — manageable, fits current stack
- **Audio/video** — requires specialized media infrastructure (LiveKit, Agora, 100ms) which scales with cost
- Connection limits and concurrent room capacity

## Recommended Phased Approach

### Phase 1: Text-only ephemeral rooms
- Room creation (topic, board, max participants, duration)
- Real-time text chat via Pusher presence channels
- Room discovery (active rooms list, board-scoped rooms)
- Host controls (pin messages, mute participants, end room)
- Schema: `rooms` table + `room_participants` table

### Phase 2: Audio rooms
- WebRTC audio via LiveKit or 100ms
- Speaker queue / raise hand
- Recording opt-in
- Listener vs speaker roles

### Phase 3: Polish
- Room scheduling (upcoming rooms)
- Room notifications (notify followers when someone starts a room)
- Room replays / highlights
- Reactions / emoji responses

## Technical Considerations

- **Pusher presence channels** — automatic join/leave tracking and participant lists, ideal for Phase 1
- **World ID verification** required to create or join rooms (prevent spam/raids)
- **Rate limiting** on room creation
- **Max concurrent rooms** per user (1 active room at a time)
- **Room TTL** — auto-close after inactivity timeout
- All messages through existing `sanitizeText()` utility
- Existing E2E encryption pattern from DMs could be adapted for private rooms

## References
- X Spaces: audio-first, ephemeral, speaker/listener model
- Discord: persistent channels, text + voice, role-based permissions
- Clubhouse: audio rooms, invite-only, raise-hand queue

---

*Next priority feature. Requires deeper research into scope, infrastructure options, and design decisions before implementation begins.*
