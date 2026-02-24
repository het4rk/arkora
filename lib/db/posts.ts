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
  return toPost(row)
}

type PostWithQuoted = { post: typeof posts.$inferSelect; quoted: typeof posts.$inferSelect | null }

export async function getPostById(id: string): Promise<Post | null> {
  const rows = await db
    .select({ post: posts, quoted: quotedPosts })
    .from(posts)
    .leftJoin(quotedPosts, eq(posts.quotedPostId, quotedPosts.id))
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
    .leftJoin(quotedPosts, eq(posts.quotedPostId, quotedPosts.id))
    .where(and(...conditions))
    .orderBy(desc(posts.createdAt))
    .limit(limit) as PostWithQuoted[]

  return rows.map((r) => toPost(r.post, r.quoted))
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
  await db.execute(
    sql`INSERT INTO post_votes (post_id, nullifier_hash, direction)
        VALUES (${postId}, ${nullifierHash}, ${direction})
        ON CONFLICT (post_id, nullifier_hash)
        DO UPDATE SET direction = ${direction}, created_at = now()`
  )

  const tallies = await db.execute<{ up: string | null; down: string | null }>(
    sql`SELECT
          SUM(CASE WHEN direction = 1 THEN 1 ELSE 0 END)::text AS up,
          SUM(CASE WHEN direction = -1 THEN 1 ELSE 0 END)::text AS down
        FROM post_votes
        WHERE post_id = ${postId}`
  )

  const row = (tallies as unknown as Array<{ up: string | null; down: string | null }>)[0]
  const up = parseInt(row?.up ?? '0', 10)
  const down = parseInt(row?.down ?? '0', 10)
  await updateVoteCounts(postId, up, down)
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
    .leftJoin(quotedPosts, eq(posts.quotedPostId, quotedPosts.id))
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
    .leftJoin(quotedPosts, eq(posts.quotedPostId, quotedPosts.id))
    .where(eq(postVotes.nullifierHash, nullifierHash))
    .orderBy(desc(postVotes.createdAt))
    .limit(Math.min(limit, 50)) as Array<PostWithQuoted & { direction: number }>

  return rows.map(({ post, quoted, direction }) => ({
    ...toPost(post, quoted),
    voteDirection: direction as 1 | -1,
  }))
}
