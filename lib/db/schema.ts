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

export type DbPost = typeof posts.$inferSelect
export type DbReply = typeof replies.$inferSelect
export type DbHumanUser = typeof humanUsers.$inferSelect
export type DbCommunityNote = typeof communityNotes.$inferSelect
export type DbPostVote = typeof postVotes.$inferSelect
export type DbBookmark = typeof bookmarks.$inferSelect
export type DbFollow = typeof follows.$inferSelect
export type DbDmKey = typeof dmKeys.$inferSelect
export type DbDmMessage = typeof dmMessages.$inferSelect
