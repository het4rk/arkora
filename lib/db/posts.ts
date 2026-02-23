import { db } from './index'
import { posts, postVotes } from './schema'
import { eq, desc, lt, and, isNull, sql } from 'drizzle-orm'
import type { Post, BoardId, CreatePostInput, FeedParams } from '@/lib/types'
import { generateSessionTag } from '@/lib/session'

// Map DB row → domain type
function toPost(row: typeof posts.$inferSelect): Post {
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
    })
    .returning()

  if (!row) throw new Error('Failed to create post')
  return toPost(row)
}

export async function getPostById(id: string): Promise<Post | null> {
  const [row] = await db.select().from(posts).where(eq(posts.id, id)).limit(1)
  return row ? toPost(row) : null
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
    .select()
    .from(posts)
    .where(and(...conditions))
    .orderBy(desc(posts.createdAt))
    .limit(limit)

  return rows.map(toPost)
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
  // Upsert: insert or update if already voted
  await db.execute(
    sql`INSERT INTO post_votes (post_id, nullifier_hash, direction)
        VALUES (${postId}, ${nullifierHash}, ${direction})
        ON CONFLICT (post_id, nullifier_hash)
        DO UPDATE SET direction = ${direction}, created_at = now()`
  )

  // Recompute tallies from source of truth
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
    .select()
    .from(posts)
    .where(and(...conditions))
    .orderBy(desc(posts.createdAt))
    .limit(Math.min(limit, 50))

  return rows.map(toPost)
}

export async function getVotedPostsByNullifier(
  nullifierHash: string,
  limit = 20
): Promise<Array<Post & { voteDirection: 1 | -1 }>> {
  const rows = await db
    .select({
      post: posts,
      direction: postVotes.direction,
    })
    .from(postVotes)
    .innerJoin(posts, and(eq(postVotes.postId, posts.id), isNull(posts.deletedAt)))
    .where(eq(postVotes.nullifierHash, nullifierHash))
    .orderBy(desc(postVotes.createdAt))
    .limit(Math.min(limit, 50))

  return rows.map(({ post, direction }) => ({
    ...toPost(post),
    voteDirection: direction as 1 | -1,
  }))
}
