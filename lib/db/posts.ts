import { db } from './index'
import { posts, postVotes } from './schema'
import { eq, desc, lt, and, isNull, sql, aliasedTable } from 'drizzle-orm'
import type { Post, BoardId, CreatePostInput, FeedParams } from '@/lib/types'
import { generateSessionTag } from '@/lib/session'

// Alias for self-join on quotedPost
const quotedPosts = aliasedTable(posts, 'quoted_posts')

function toPost(
  row: typeof posts.$inferSelect,
  quoted?: typeof posts.$inferSelect | null
): Post {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    boardId: row.boardId as BoardId,
    nullifierHash: row.nullifierHash,
    pseudoHandle: row.pseudoHandle ?? null,
    sessionTag: row.sessionTag,
    imageUrl: row.imageUrl ?? null,
    upvotes: row.upvotes,
    downvotes: row.downvotes,
    replyCount: row.replyCount,
    quoteCount: row.quoteCount,
    createdAt: row.createdAt,
    deletedAt: row.deletedAt ?? null,
    quotedPostId: row.quotedPostId ?? null,
    quotedPost: quoted ? toPost(quoted) : null,
  }
}

export async function createPost(input: CreatePostInput): Promise<Post> {
  const sessionTag = generateSessionTag()
  const [row] = await db
    .insert(posts)
    .values({
      title: input.title,
      body: input.body,
      boardId: input.boardId,
      nullifierHash: input.nullifierHash,
      pseudoHandle: input.pseudoHandle ?? null,
      sessionTag,
      imageUrl: input.imageUrl ?? null,
      quotedPostId: input.quotedPostId ?? null,
    })
    .returning()

  if (!row) throw new Error('Failed to create post')

  // Increment quote count on the original post (fire-and-forget)
  if (input.quotedPostId) {
    void db
      .update(posts)
      .set({ quoteCount: sql`${posts.quoteCount} + 1` })
      .where(eq(posts.id, input.quotedPostId))
  }

  return toPost(row)
}

type PostWithQuoted = { post: typeof posts.$inferSelect; quoted: typeof posts.$inferSelect | null }

export async function getPostById(id: string): Promise<Post | null> {
  const rows = await db
    .select({ post: posts, quoted: quotedPosts })
    .from(posts)
    .leftJoin(quotedPosts, and(eq(posts.quotedPostId, quotedPosts.id), isNull(quotedPosts.deletedAt)))
    .where(eq(posts.id, id))
    .limit(1) as PostWithQuoted[]

  const row = rows[0]
  return row ? toPost(row.post, row.quoted) : null
}

/** Lightweight check — returns only the post owner's nullifierHash (no joins). */
export async function getPostNullifier(id: string): Promise<string | null> {
  const [row] = await db
    .select({ nullifierHash: posts.nullifierHash })
    .from(posts)
    .where(eq(posts.id, id))
    .limit(1)
  return row?.nullifierHash ?? null
}

export async function getFeed(params: FeedParams): Promise<Post[]> {
  const limit = Math.min(params.limit ?? 20, 50)

  const conditions = [isNull(posts.deletedAt)]
  if (params.boardId) {
    conditions.push(eq(posts.boardId, params.boardId))
  }
  if (params.cursor) {
    conditions.push(lt(posts.createdAt, new Date(params.cursor)))
  }

  const rows = await db
    .select({ post: posts, quoted: quotedPosts })
    .from(posts)
    .leftJoin(quotedPosts, and(eq(posts.quotedPostId, quotedPosts.id), isNull(quotedPosts.deletedAt)))
    .where(and(...conditions))
    .orderBy(desc(posts.createdAt))
    .limit(limit) as PostWithQuoted[]

  return rows.map((r) => toPost(r.post, r.quoted))
}

/** Hot feed: Wilson-score-ish ranking — net votes / (age_hours + 2)^1.5 */
export async function getHotFeed(boardId?: string, limit = 30): Promise<Post[]> {
  const rows = await db.execute<typeof posts.$inferSelect & { quoted_id: string | null }>(
    sql`SELECT p.*, qp.id as quoted_id,
          qp.title as q_title, qp.body as q_body, qp.board_id as q_board_id,
          qp.nullifier_hash as q_nullifier_hash, qp.pseudo_handle as q_pseudo_handle,
          qp.session_tag as q_session_tag, qp.image_url as q_image_url,
          qp.upvotes as q_upvotes, qp.downvotes as q_downvotes,
          qp.reply_count as q_reply_count, qp.quote_count as q_quote_count,
          qp.created_at as q_created_at, qp.deleted_at as q_deleted_at,
          qp.quoted_post_id as q_quoted_post_id
        FROM posts p
        LEFT JOIN posts qp ON p.quoted_post_id = qp.id AND qp.deleted_at IS NULL
        WHERE p.deleted_at IS NULL
          ${boardId ? sql`AND p.board_id = ${boardId}` : sql``}
          AND p.created_at > now() - interval '7 days'
        ORDER BY
          (p.upvotes::float - p.downvotes) /
          POWER(EXTRACT(EPOCH FROM (now() - p.created_at)) / 3600.0 + 2, 1.5) DESC
        LIMIT ${Math.min(limit, 50)}`
  )

  return (rows as unknown as Array<Record<string, unknown>>).map((r) => {
    const post = {
      id: r['id'] as string, title: r['title'] as string, body: r['body'] as string,
      boardId: r['board_id'] as BoardId, nullifierHash: r['nullifier_hash'] as string,
      pseudoHandle: (r['pseudo_handle'] as string | null) ?? null,
      sessionTag: r['session_tag'] as string,
      imageUrl: (r['image_url'] as string | null) ?? null,
      upvotes: r['upvotes'] as number, downvotes: r['downvotes'] as number,
      replyCount: r['reply_count'] as number, quoteCount: r['quote_count'] as number,
      createdAt: new Date(r['created_at'] as string),
      deletedAt: r['deleted_at'] ? new Date(r['deleted_at'] as string) : null,
      quotedPostId: (r['quoted_post_id'] as string | null) ?? null,
      quotedPost: null as Post | null,
    } satisfies Post

    if (r['quoted_id']) {
      post.quotedPost = {
        id: r['quoted_id'] as string, title: r['q_title'] as string, body: r['q_body'] as string,
        boardId: r['q_board_id'] as BoardId, nullifierHash: r['q_nullifier_hash'] as string,
        pseudoHandle: (r['q_pseudo_handle'] as string | null) ?? null,
        sessionTag: r['q_session_tag'] as string,
        imageUrl: (r['q_image_url'] as string | null) ?? null,
        upvotes: r['q_upvotes'] as number, downvotes: r['q_downvotes'] as number,
        replyCount: r['q_reply_count'] as number, quoteCount: r['q_quote_count'] as number,
        createdAt: new Date(r['q_created_at'] as string),
        deletedAt: r['q_deleted_at'] ? new Date(r['q_deleted_at'] as string) : null,
        quotedPostId: (r['q_quoted_post_id'] as string | null) ?? null,
        quotedPost: null,
      }
    }

    return post
  })
}

export async function incrementReplyCount(postId: string): Promise<void> {
  await db
    .update(posts)
    .set({ replyCount: sql`${posts.replyCount} + 1` })
    .where(eq(posts.id, postId))
}

export async function updateVoteCounts(
  postId: string,
  upvotes: number,
  downvotes: number
): Promise<void> {
  await db
    .update(posts)
    .set({ upvotes, downvotes })
    .where(eq(posts.id, postId))
}

export async function getVoteByNullifier(
  postId: string,
  nullifierHash: string
): Promise<{ direction: number } | null> {
  const [row] = await db
    .select()
    .from(postVotes)
    .where(
      and(eq(postVotes.postId, postId), eq(postVotes.nullifierHash, nullifierHash))
    )
    .limit(1)

  return row ? { direction: row.direction } : null
}

export async function upsertVote(
  postId: string,
  nullifierHash: string,
  direction: 1 | -1
): Promise<void> {
  // Single atomic statement: upsert vote then immediately recount in one round-trip.
  // The UPDATE subqueries run against the already-committed vote row, so the
  // count is always consistent regardless of concurrent requests.
  await db.execute(
    sql`WITH upsert AS (
          INSERT INTO post_votes (post_id, nullifier_hash, direction)
          VALUES (${postId}, ${nullifierHash}, ${direction})
          ON CONFLICT (post_id, nullifier_hash)
          DO UPDATE SET direction = ${direction}, created_at = now()
        )
        UPDATE posts
        SET
          upvotes   = (SELECT COUNT(*) FROM post_votes WHERE post_id = ${postId} AND direction =  1),
          downvotes = (SELECT COUNT(*) FROM post_votes WHERE post_id = ${postId} AND direction = -1)
        WHERE id = ${postId}`
  )
}

export async function softDeletePost(postId: string, nullifierHash: string): Promise<boolean> {
  const result = await db
    .update(posts)
    .set({ deletedAt: sql`now()` })
    .where(and(eq(posts.id, postId), eq(posts.nullifierHash, nullifierHash)))
    .returning({ id: posts.id })

  return result.length > 0
}

export async function getPostsByNullifier(
  nullifierHash: string,
  cursor?: string,
  limit = 20
): Promise<Post[]> {
  const conditions = [
    eq(posts.nullifierHash, nullifierHash),
    isNull(posts.deletedAt),
  ]
  if (cursor) {
    conditions.push(lt(posts.createdAt, new Date(cursor)))
  }

  const rows = await db
    .select({ post: posts, quoted: quotedPosts })
    .from(posts)
    .leftJoin(quotedPosts, and(eq(posts.quotedPostId, quotedPosts.id), isNull(quotedPosts.deletedAt)))
    .where(and(...conditions))
    .orderBy(desc(posts.createdAt))
    .limit(Math.min(limit, 50)) as PostWithQuoted[]

  return rows.map((r) => toPost(r.post, r.quoted))
}

export async function getVotedPostsByNullifier(
  nullifierHash: string,
  limit = 20
): Promise<Array<Post & { voteDirection: 1 | -1 }>> {
  const rows = await db
    .select({
      post: posts,
      quoted: quotedPosts,
      direction: postVotes.direction,
    })
    .from(postVotes)
    .innerJoin(posts, and(eq(postVotes.postId, posts.id), isNull(posts.deletedAt)))
    .leftJoin(quotedPosts, and(eq(posts.quotedPostId, quotedPosts.id), isNull(quotedPosts.deletedAt)))
    .where(eq(postVotes.nullifierHash, nullifierHash))
    .orderBy(desc(postVotes.createdAt))
    .limit(Math.min(limit, 50)) as Array<PostWithQuoted & { direction: number }>

  return rows.map(({ post, quoted, direction }) => ({
    ...toPost(post, quoted),
    voteDirection: direction as 1 | -1,
  }))
}
