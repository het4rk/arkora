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
  },
  (table) => ({
    boardIdx: index('posts_board_id_idx').on(table.boardId),
    createdAtIdx: index('posts_created_at_idx').on(table.createdAt),
    nullifierIdx: index('posts_nullifier_idx').on(table.nullifierHash),
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
  })
)

export const humanUsers = pgTable('human_users', {
  nullifierHash: text('nullifier_hash').primaryKey(),
  walletAddress: text('wallet_address').notNull(),
  pseudoHandle: text('pseudo_handle'),
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
  })
)

export type DbPost = typeof posts.$inferSelect
export type DbReply = typeof replies.$inferSelect
export type DbHumanUser = typeof humanUsers.$inferSelect
export type DbCommunityNote = typeof communityNotes.$inferSelect
export type DbPostVote = typeof postVotes.$inferSelect
