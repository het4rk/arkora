/** Any normalized board slug - can be a featured board or a user-created one. */
export type BoardId = string

export { FEATURED_BOARDS as BOARDS } from '@/lib/boards'

/** Boards where posts are force-anonymous regardless of the user's identity mode. */
export const ANONYMOUS_BOARDS: Set<string> = new Set(['confessions'])

export interface Post {
  id: string
  title: string
  body: string
  boardId: BoardId
  nullifierHash: string
  pseudoHandle: string | null
  sessionTag: string
  imageUrl: string | null
  upvotes: number
  downvotes: number
  replyCount: number
  quoteCount: number
  createdAt: Date
  quotedPostId: string | null
  quotedPost: Post | null
  lat: number | null
  lng: number | null
  countryCode: string | null
  type: 'text' | 'poll' | 'repost'
  pollOptions: { index: number; text: string }[] | null
  pollEndsAt: Date | null
  contentHash: string | null
  authorKarmaScore?: number | null
}

export interface PollResult {
  optionIndex: number
  count: number
}

export interface Reply {
  id: string
  postId: string
  parentReplyId: string | null
  body: string
  nullifierHash: string
  pseudoHandle: string | null
  sessionTag: string
  imageUrl: string | null
  upvotes: number
  downvotes: number
  createdAt: Date
}

export interface HumanUser {
  nullifierHash: string
  walletAddress: string
  pseudoHandle: string | null
  avatarUrl: string | null
  bio: string | null
  identityMode: 'anonymous' | 'alias' | 'named'
  karmaScore: number
  worldIdVerified: boolean
  verifiedBlockNumber: number | null
  registrationTxHash: string | null
  createdAt: Date
}

export interface CommunityNote {
  id: string
  postId: string
  body: string
  submitterNullifierHash: string
  helpfulVotes: number
  notHelpfulVotes: number
  isPromoted: boolean
  createdAt: Date
}

// API shapes
export interface CreatePostInput {
  title: string
  body: string
  boardId: BoardId
  nullifierHash: string
  pseudoHandle?: string | undefined
  imageUrl?: string | undefined
  quotedPostId?: string | undefined
  lat?: number | undefined
  lng?: number | undefined
  countryCode?: string | undefined
  type?: 'text' | 'poll' | 'repost'
  pollOptions?: { index: number; text: string }[]
  pollDuration?: number
  pollEndsAt?: Date | undefined
}

export interface CreateReplyInput {
  postId: string
  parentReplyId?: string | undefined
  body: string
  nullifierHash: string
  pseudoHandle?: string | undefined
  imageUrl?: string | undefined
}

export interface VoteInput {
  postId: string
  direction: 1 | -1
  nullifierHash: string
}

export interface Notification {
  id: string
  recipientHash: string
  type: 'reply' | 'follow' | 'dm' | 'like' | 'quote' | 'repost' | 'mention'
  referenceId: string | null
  actorHash: string | null
  read: boolean
  createdAt: Date
}

// Notification enriched with identity-aware actor display name
export interface EnrichedNotification extends Notification {
  actorDisplay: string | null  // null = actor is anonymous; string = alias or @username
}

// ── Rooms ─────────────────────────────────────────────────────────────────────

export interface Room {
  id: string
  title: string
  boardId: BoardId
  hostHash: string
  hostHandle: string
  maxParticipants: number
  isLive: boolean
  createdAt: Date
  endsAt: Date
  messageCount: number
  participantCount?: number // populated when fetching room list/detail
}

export interface RoomParticipant {
  id: string
  roomId: string
  nullifierHash: string
  displayHandle: string
  identityMode: 'anonymous' | 'alias' | 'named'
  joinedAt: Date
  leftAt: Date | null
  isMuted: boolean
  isCoHost: boolean
}

// Shape of messages delivered over Pusher (not stored in DB)
export interface RoomMessage {
  id: string
  senderHash: string
  displayHandle: string
  text: string
  createdAt: string // ISO string for Pusher transport
}

export interface CreateNoteInput {
  postId: string
  body: string
  submitterNullifierHash: string
}

export interface FeedParams {
  boardId?: BoardId | undefined
  cursor?: string | undefined
  limit?: number | undefined
}

export interface LocalFeedParams {
  countryCode: string
  lat?: number | undefined
  lng?: number | undefined
  radiusMiles?: number | undefined  // -1 or undefined = country-only
  boardId?: BoardId | undefined
  cursor?: string | undefined
  limit?: number | undefined
}

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string }
