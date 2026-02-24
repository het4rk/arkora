import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core'

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
  },
  (table) => ({
    boardIdx: index('posts_board_id_idx').on(table.boardId),
    createdAtIdx: index('posts_created_at_idx').on(table.createdAt),
    // Composite covers getPostsByNullifier (filter + order) in a single index scan
    nullifierCreatedIdx: index('posts_nullifier_created_idx').on(table.nullifierHash, table.createdAt),
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
  })
)

export const humanUsers = pgTable('human_users', {
  nullifierHash: text('nullifier_hash').primaryKey(),
  walletAddress: text('wallet_address').notNull(),
  pseudoHandle: text('pseudo_handle'),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

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
  })
)

export type DbTip = typeof tips.$inferSelect
export type DbSubscription = typeof subscriptions.$inferSelect
