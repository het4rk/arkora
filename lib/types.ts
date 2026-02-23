export type BoardId = 'agora' | 'technology' | 'markets' | 'politics' | 'worldchain'

export const BOARDS: { id: BoardId; label: string; emoji: string }[] = [
  { id: 'agora', label: 'Agora', emoji: '🏛️' },
  { id: 'technology', label: 'Technology', emoji: '⚡' },
  { id: 'markets', label: 'Markets', emoji: '📈' },
  { id: 'politics', label: 'Politics', emoji: '🗳️' },
  { id: 'worldchain', label: 'World Chain', emoji: '🌐' },
]

export interface Post {
  id: string
  title: string
  body: string
  boardId: BoardId
  nullifierHash: string
  pseudoHandle: string | null
  sessionTag: string
  upvotes: number
  downvotes: number
  replyCount: number
  createdAt: Date
}

export interface Reply {
  id: string
  postId: string
  parentReplyId: string | null
  body: string
  nullifierHash: string
  pseudoHandle: string | null
  sessionTag: string
  upvotes: number
  downvotes: number
  createdAt: Date
}

export interface HumanUser {
  nullifierHash: string
  walletAddress: string
  pseudoHandle: string | null
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
}

export interface CreateReplyInput {
  postId: string
  parentReplyId?: string | undefined
  body: string
  nullifierHash: string
  pseudoHandle?: string | undefined
}

export interface VoteInput {
  postId: string
  direction: 1 | -1
  nullifierHash: string
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

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string }
