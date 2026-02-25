import {
  pgTable,
  text,
  integer,
  real,
  boolean,
  timestamp,
  uuid,
  index,
  uniqueIndex,
  primaryKey,
  jsonb,
  unique,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const posts = pgTable(
  'posts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    boardId: text('board_id').notNull(),
    nullifierHash: text('nullifier_hash').notNull(),
    pseudoHandle: text('pseudo_handle'),
    sessionTag: text('session_tag').notNull(),
    imageUrl: text('image_url'),
    upvotes: integer('upvotes').default(0).notNull(),
    downvotes: integer('downvotes').default(0).notNull(),
    replyCount: integer('reply_count').default(0).notNull(),
    quoteCount: integer('quote_count').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
    quotedPostId: uuid('quoted_post_id'),
    // Location — optional; set when poster has location sharing enabled
    lat: real('lat'),
    lng: real('lng'),
    // Country inferred from poster's IP at creation time (for local feed country filter)
    countryCode: text('country_code'),
    // Poll fields — only set when type = 'poll'
    type: text('type').notNull().default('text'), // 'text' | 'poll'
    pollOptions: jsonb('poll_options').$type<{ index: number; text: string }[]>(),
    pollEndsAt: timestamp('poll_ends_at', { withTimezone: true }),
  },
  (table) => ({
    boardIdx: index('posts_board_id_idx').on(table.boardId),
    createdAtIdx: index('posts_created_at_idx').on(table.createdAt),
    // Composite covers getPostsByNullifier (filter + order) in a single index scan
    nullifierCreatedIdx: index('posts_nullifier_created_idx').on(table.nullifierHash, table.createdAt),
    // Local feed: filter by country then sort by time
    countryCreatedIdx: index('posts_country_created_idx').on(table.countryCode, table.createdAt),
  })
)

export const replies = pgTable(
  'replies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    postId: uuid('post_id')
      .references(() => posts.id, { onDelete: 'cascade' })
      .notNull(),
    parentReplyId: uuid('parent_reply_id'),
    body: text('body').notNull(),
    nullifierHash: text('nullifier_hash').notNull(),
    pseudoHandle: text('pseudo_handle'),
    sessionTag: text('session_tag').notNull(),
    imageUrl: text('image_url'),
    upvotes: integer('upvotes').default(0).notNull(),
    downvotes: integer('downvotes').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => ({
    postIdIdx: index('replies_post_id_idx').on(table.postId),
    createdAtIdx: index('replies_created_at_idx').on(table.createdAt),
    nullifierIdx: index('replies_nullifier_hash_idx').on(table.nullifierHash),
    // Covers getRepliesByPostId sort: filter by postId + order by upvotes DESC, createdAt DESC
    postSortIdx: index('replies_post_sort_idx').on(table.postId, table.upvotes, table.createdAt),
  })
)

export const humanUsers = pgTable(
  'human_users',
  {
    nullifierHash: text('nullifier_hash').primaryKey(),
    walletAddress: text('wallet_address').notNull(),
    pseudoHandle: text('pseudo_handle'),
    avatarUrl: text('avatar_url'),
    bio: text('bio'),
    identityMode: text('identity_mode').default('anonymous').notNull(), // 'anonymous' | 'alias' | 'named'
    // Net upvotes received across all posts + replies. Updated incrementally on vote.
    karmaScore: integer('karma_score').default(0).notNull(),
    // True only after successful World ID Orb/Device verification via /api/verify.
    // Wallet-only (SIWE) users start as false and cannot post/reply/vote.
    // DEFAULT true so existing verified users keep access after migration.
    worldIdVerified: boolean('world_id_verified').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    // Speeds up @mention autocomplete: pseudoHandle ILIKE prefix% + identityMode filter
    pseudoHandleIdx: index('human_users_pseudo_handle_idx').on(table.pseudoHandle),
  })
)

export const communityNotes = pgTable(
  'community_notes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    postId: uuid('post_id')
      .references(() => posts.id, { onDelete: 'cascade' })
      .notNull(),
    body: text('body').notNull(),
    submitterNullifierHash: text('submitter_nullifier_hash').notNull(),
    helpfulVotes: integer('helpful_votes').default(0).notNull(),
    notHelpfulVotes: integer('not_helpful_votes').default(0).notNull(),
    isPromoted: boolean('is_promoted').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    postIdIdx: index('notes_post_id_idx').on(table.postId),
  })
)

// Vote tracking table (off-chain mirror of onchain state for fast reads)
export const postVotes = pgTable(
  'post_votes',
  {
    postId: uuid('post_id')
      .references(() => posts.id, { onDelete: 'cascade' })
      .notNull(),
    nullifierHash: text('nullifier_hash').notNull(),
    direction: integer('direction').notNull(), // 1 | -1
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.postId, table.nullifierHash] }),
    // Separate index so "get all posts voted by user" doesn't scan from postId
    nullifierIdx: index('post_votes_nullifier_hash_idx').on(table.nullifierHash),
  })
)

export const bookmarks = pgTable(
  'bookmarks',
  {
    nullifierHash: text('nullifier_hash').notNull(),
    postId: uuid('post_id')
      .references(() => posts.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.nullifierHash, table.postId] }),
    nullifierIdx: index('bookmarks_nullifier_idx').on(table.nullifierHash),
  })
)

export const follows = pgTable(
  'follows',
  {
    followerId: text('follower_id').notNull(),
    followedId: text('followed_id').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.followerId, table.followedId] }),
    followerIdx: index('follows_follower_idx').on(table.followerId),
    followedIdx: index('follows_followed_idx').on(table.followedId),
  })
)

// ── Direct Messages ──────────────────────────────────────────────────────────
// Public key registry — one row per user, updated when they register a new key
export const dmKeys = pgTable('dm_keys', {
  nullifierHash: text('nullifier_hash').primaryKey(),
  publicKey: text('public_key').notNull(),   // base64url Curve25519 public key
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Encrypted message blobs — server stores ciphertext only
export const dmMessages = pgTable(
  'dm_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    senderHash: text('sender_hash').notNull(),
    recipientHash: text('recipient_hash').notNull(),
    ciphertext: text('ciphertext').notNull(),   // base64 AES-256-GCM ciphertext
    nonce: text('nonce').notNull(),             // base64 12-byte GCM nonce
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    convIdx: index('dm_messages_conv_idx').on(table.senderHash, table.recipientHash),
    recipientIdx: index('dm_messages_recipient_idx').on(table.recipientHash, table.createdAt),
  })
)

export const replyVotes = pgTable(
  'reply_votes',
  {
    replyId: uuid('reply_id')
      .references(() => replies.id, { onDelete: 'cascade' })
      .notNull(),
    nullifierHash: text('nullifier_hash').notNull(),
    direction: integer('direction').notNull(), // 1 | -1
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.replyId, table.nullifierHash] }),
    nullifierIdx: index('reply_votes_nullifier_idx').on(table.nullifierHash),
  })
)

export const communityNoteVotes = pgTable(
  'community_note_votes',
  {
    noteId: uuid('note_id')
      .references(() => communityNotes.id, { onDelete: 'cascade' })
      .notNull(),
    nullifierHash: text('nullifier_hash').notNull(),
    helpful: boolean('helpful').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.noteId, table.nullifierHash] }),
  })
)

// Sybil-resistant poll votes — one row per (postId, nullifierHash) enforced by unique constraint
export const pollVotes = pgTable(
  'poll_votes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
    nullifierHash: text('nullifier_hash').notNull(),
    optionIndex: integer('option_index').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqueVote: unique().on(t.postId, t.nullifierHash),
    postIdx: index('poll_votes_post_idx').on(t.postId),
  })
)

export type DbPollVote = typeof pollVotes.$inferSelect

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    recipientHash: text('recipient_hash').notNull(),
    type: text('type').notNull(), // 'reply' | 'follow' | 'dm'
    referenceId: text('reference_id'), // postId for reply, senderHash for dm
    actorHash: text('actor_hash'),     // who triggered it (null = anonymous)
    read: boolean('read').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    recipientIdx: index('notifications_recipient_idx').on(table.recipientHash, table.createdAt),
    // Partial index for the unread-count query — only indexes unread rows
    unreadIdx: index('notifications_unread_idx').on(table.recipientHash, table.createdAt).where(sql`read = false`),
  })
)

export type DbPost = typeof posts.$inferSelect
export type DbReply = typeof replies.$inferSelect
export type DbHumanUser = typeof humanUsers.$inferSelect
export type DbCommunityNote = typeof communityNotes.$inferSelect
export type DbPostVote = typeof postVotes.$inferSelect
export type DbBookmark = typeof bookmarks.$inferSelect
export type DbFollow = typeof follows.$inferSelect
export type DbDmKey = typeof dmKeys.$inferSelect
export type DbDmMessage = typeof dmMessages.$inferSelect
export type DbReplyVote = typeof replyVotes.$inferSelect
export type DbCommunityNoteVote = typeof communityNoteVotes.$inferSelect

// ── Tips ──────────────────────────────────────────────────────────────────────
export const tips = pgTable(
  'tips',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    senderHash: text('sender_hash').notNull(),
    recipientHash: text('recipient_hash').notNull(),
    recipientWallet: text('recipient_wallet').notNull(),
    amountWld: text('amount_wld').notNull(),
    txId: text('tx_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    recipientIdx: index('tips_recipient_idx').on(t.recipientHash),
  })
)

// ── Subscriptions ─────────────────────────────────────────────────────────────
export const subscriptions = pgTable(
  'subscriptions',
  {
    subscriberHash: text('subscriber_hash').notNull(),
    creatorHash: text('creator_hash').notNull(),
    creatorWallet: text('creator_wallet').notNull(),
    amountWld: text('amount_wld').notNull().default('1'),
    txId: text('tx_id'),
    startedAt: timestamp('started_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    cancelledAt: timestamp('cancelled_at'),
    isActive: boolean('is_active').default(true).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.subscriberHash, t.creatorHash] }),
    creatorIdx: index('subscriptions_creator_idx').on(t.creatorHash),
    subscriberIdx: index('subscriptions_subscriber_idx').on(t.subscriberHash),
    // Partial index for active subscription lookups (getSubscriberCount, getActiveSubscription)
    activeCreatorIdx: index('subscriptions_active_creator_idx').on(t.creatorHash, t.expiresAt).where(sql`is_active = true`),
  })
)

export type DbTip = typeof tips.$inferSelect
export type DbSubscription = typeof subscriptions.$inferSelect

// ── Reports ──────────────────────────────────────────────────────────────────
export const reports = pgTable(
  'reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reporterHash: text('reporter_hash').notNull(),
    targetType: text('target_type').notNull(), // 'post' | 'reply' | 'user'
    targetId: text('target_id').notNull(),      // postId, replyId, or nullifierHash
    reason: text('reason').notNull(),           // 'spam' | 'harassment' | 'hate' | 'violence' | 'misinformation' | 'other'
    details: text('details'),
    status: text('status').default('pending').notNull(), // 'pending' | 'reviewed' | 'actioned' | 'dismissed'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    targetIdx: index('reports_target_idx').on(table.targetType, table.targetId),
    statusIdx: index('reports_status_idx').on(table.status),
    // Prevent duplicate reports from same user on same target (DB-level enforcement)
    reporterTargetIdx: uniqueIndex('reports_reporter_target_idx').on(table.reporterHash, table.targetType, table.targetId),
  })
)

export type DbReport = typeof reports.$inferSelect

// ── Blocks ───────────────────────────────────────────────────────────────────
export const blocks = pgTable(
  'blocks',
  {
    blockerHash: text('blocker_hash').notNull(),
    blockedHash: text('blocked_hash').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.blockerHash, table.blockedHash] }),
    blockerIdx: index('blocks_blocker_idx').on(table.blockerHash),
    blockedIdx: index('blocks_blocked_idx').on(table.blockedHash),
  })
)

export type DbBlock = typeof blocks.$inferSelect

// ── Rooms ─────────────────────────────────────────────────────────────────────
export const rooms = pgTable(
  'rooms',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    boardId: text('board_id').notNull(),
    hostHash: text('host_hash').notNull(),
    hostHandle: text('host_handle').notNull(),
    maxParticipants: integer('max_participants').default(50).notNull(),
    isLive: boolean('is_live').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    endsAt: timestamp('ends_at').notNull(),
    messageCount: integer('message_count').default(0).notNull(),
  },
  (table) => ({
    boardLiveIdx: index('rooms_board_live_idx').on(table.boardId, table.isLive),
    createdAtIdx: index('rooms_created_at_idx').on(table.createdAt),
  })
)

export const roomParticipants = pgTable(
  'room_participants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    roomId: uuid('room_id')
      .references(() => rooms.id, { onDelete: 'cascade' })
      .notNull(),
    nullifierHash: text('nullifier_hash').notNull(),
    displayHandle: text('display_handle').notNull(),
    identityMode: text('identity_mode').notNull(), // 'anonymous' | 'alias' | 'named'
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
    leftAt: timestamp('left_at'),
    isMuted: boolean('is_muted').default(false).notNull(),
    isCoHost: boolean('is_co_host').default(false).notNull(),
  },
  (table) => ({
    roomIdx: index('room_participants_room_idx').on(table.roomId),
    userRoomIdx: index('room_participants_user_room_idx').on(table.nullifierHash, table.roomId),
  })
)

export type DbRoom = typeof rooms.$inferSelect
export type DbRoomParticipant = typeof roomParticipants.$inferSelect
