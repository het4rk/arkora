import { db } from './index'
import { replies, replyVotes, posts } from './schema'
import { eq, desc, and, or, sql, inArray, lt } from 'drizzle-orm'
import type { Reply, CreateReplyInput } from '@/lib/types'
import { generateSessionTag } from '@/lib/session'
import { incrementReplyCount, decrementReplyCount } from './posts'

function toReply(row: typeof replies.$inferSelect): Reply {
  return {
    id: row.id,
    postId: row.postId,
    parentReplyId: row.parentReplyId ?? null,
    body: row.body,
    nullifierHash: row.nullifierHash,
    pseudoHandle: row.pseudoHandle ?? null,
    sessionTag: row.sessionTag,
    imageUrl: row.imageUrl ?? null,
    upvotes: row.upvotes,
    downvotes: row.downvotes,
    createdAt: row.createdAt,
    postIdentityMode: (row.postIdentityMode as 'anonymous' | 'alias' | 'named') ?? 'anonymous',
    // authorNullifier is NEVER included - internal only
  }
}

export async function createReply(input: CreateReplyInput): Promise<Reply> {
  const sessionTag = generateSessionTag()
  const [row] = await db
    .insert(replies)
    .values({
      postId: input.postId,
      parentReplyId: input.parentReplyId ?? null,
      body: input.body,
      nullifierHash: input.nullifierHash,
      pseudoHandle: input.pseudoHandle ?? null,
      sessionTag,
      imageUrl: input.imageUrl ?? null,
      authorNullifier: input.authorNullifier ?? input.nullifierHash,
      postIdentityMode: input.postIdentityMode ?? 'anonymous',
    })
    .returning()

  if (!row) throw new Error('Failed to create reply')
  await incrementReplyCount(input.postId)
  return toReply(row)
}

export async function getRepliesByPostId(
  postId: string,
  options?: { cursor?: string; limit?: number }
): Promise<{ replies: Reply[]; nextCursor: string | null }> {
  // Return replies including deleted ones so thread tree stays intact.
  // UI renders deleted replies as tombstones.
  // Cursor-based pagination: sort by createdAt DESC, cursor is ISO timestamp.
  const pageLimit = Math.min(options?.limit ?? 20, 100)

  const conditions = [eq(replies.postId, postId)]
  if (options?.cursor) {
    conditions.push(lt(replies.createdAt, new Date(options.cursor)))
  }

  const rows = await db
    .select()
    .from(replies)
    .where(and(...conditions))
    .orderBy(desc(replies.createdAt))
    .limit(pageLimit + 1)

  const hasMore = rows.length > pageLimit
  const page = hasMore ? rows.slice(0, pageLimit) : rows
  const lastRow = page[page.length - 1]
  const nextCursor = hasMore && lastRow ? lastRow.createdAt.toISOString() : null

  return { replies: page.map(toReply), nextCursor }
}

export async function deleteReply(replyId: string, nullifierHash: string): Promise<boolean> {
  // Check authorNullifier for ownership (real identity), falling back to nullifierHash for pre-migration data
  const result = await db
    .delete(replies)
    .where(and(
      eq(replies.id, replyId),
      or(eq(replies.authorNullifier, nullifierHash), eq(replies.nullifierHash, nullifierHash))!,
    ))
    .returning({ id: replies.id, postId: replies.postId })

  if (result.length > 0 && result[0]) {
    await decrementReplyCount(result[0].postId)
    return true
  }
  return false
}

/** Atomic upsert vote + recount. Returns the updated vote counts. */
export async function upsertReplyVote(
  replyId: string,
  nullifierHash: string,
  direction: 1 | -1
): Promise<{ upvotes: number; downvotes: number }> {
  const [row] = await db.execute<{ upvotes: number | string; downvotes: number | string }>(
    sql`WITH upsert AS (
          INSERT INTO reply_votes (reply_id, nullifier_hash, direction)
          VALUES (${replyId}, ${nullifierHash}, ${direction})
          ON CONFLICT (reply_id, nullifier_hash)
          DO UPDATE SET direction = ${direction}, created_at = now()
        )
        UPDATE replies
        SET
          upvotes   = (SELECT COUNT(*) FROM reply_votes WHERE reply_id = ${replyId} AND direction =  1),
          downvotes = (SELECT COUNT(*) FROM reply_votes WHERE reply_id = ${replyId} AND direction = -1)
        WHERE id = ${replyId}
        RETURNING upvotes, downvotes`
  )
  return {
    upvotes: Number(row?.upvotes ?? 0),
    downvotes: Number(row?.downvotes ?? 0),
  }
}

/** Delete a reply vote and recount atomically in a single statement. */
export async function deleteReplyVote(
  replyId: string,
  nullifierHash: string
): Promise<{ upvotes: number; downvotes: number }> {
  const [row] = await db.execute<{ upvotes: number | string; downvotes: number | string }>(
    sql`WITH deleted AS (
          DELETE FROM reply_votes
          WHERE reply_id = ${replyId} AND nullifier_hash = ${nullifierHash}
        )
        UPDATE replies
        SET
          upvotes   = (SELECT COUNT(*) FROM reply_votes WHERE reply_id = ${replyId} AND direction =  1),
          downvotes = (SELECT COUNT(*) FROM reply_votes WHERE reply_id = ${replyId} AND direction = -1)
        WHERE id = ${replyId}
        RETURNING upvotes, downvotes`
  )
  return {
    upvotes: Number(row?.upvotes ?? 0),
    downvotes: Number(row?.downvotes ?? 0),
  }
}

/** Fetch the postId a reply belongs to. Used to validate parentReplyId. */
export async function getReplyPostId(replyId: string): Promise<string | null> {
  const [row] = await db
    .select({ postId: replies.postId })
    .from(replies)
    .where(eq(replies.id, replyId))
    .limit(1)
  return row?.postId ?? null
}

/** Look up the nullifier hash of a reply's author. */
export async function getReplyNullifier(replyId: string): Promise<string | null> {
  const [row] = await db
    .select({ nullifierHash: replies.nullifierHash })
    .from(replies)
    .where(eq(replies.id, replyId))
    .limit(1)
  return row?.nullifierHash ?? null
}

/** Get the existing vote direction (1 | -1) a user cast on a reply, or null if not voted. */
export async function getReplyVoteByNullifier(
  replyId: string,
  nullifierHash: string
): Promise<{ direction: number } | null> {
  const [row] = await db
    .select({ direction: replyVotes.direction })
    .from(replyVotes)
    .where(and(eq(replyVotes.replyId, replyId), eq(replyVotes.nullifierHash, nullifierHash)))
    .limit(1)
  return row ? { direction: row.direction } : null
}

export async function getRepliesByNullifier(
  nullifierHash: string,
  limit = 30
): Promise<Array<Reply & { postTitle: string | null }>> {
  const rows = await db
    .select({
      reply: replies,
      postTitle: posts.title,
    })
    .from(replies)
    .innerJoin(posts, eq(replies.postId, posts.id))
    .where(eq(replies.nullifierHash, nullifierHash))
    .orderBy(desc(replies.createdAt))
    .limit(Math.min(limit, 50))

  return rows.map(({ reply, postTitle }) => ({
    ...toReply(reply),
    postTitle: postTitle ?? null,
  }))
}

export async function getRepliesByNullifiers(
  nullifiers: string[],
  limit = 30
): Promise<Array<Reply & { postTitle: string | null }>> {
  if (nullifiers.length === 0) return []
  if (nullifiers.length === 1) return getRepliesByNullifier(nullifiers[0]!, limit)

  const rows = await db
    .select({
      reply: replies,
      postTitle: posts.title,
    })
    .from(replies)
    .innerJoin(posts, eq(replies.postId, posts.id))
    .where(inArray(replies.nullifierHash, nullifiers))
    .orderBy(desc(replies.createdAt))
    .limit(Math.min(limit, 50))

  return rows.map(({ reply, postTitle }) => ({
    ...toReply(reply),
    postTitle: postTitle ?? null,
  }))
}

/**
 * Fetch replies by the internal author nullifier (real identity).
 * Used for own-profile views where the user needs to see ALL their replies
 * including anonymous and alias replies.
 */
export async function getRepliesByAuthorNullifiers(
  nullifiers: string[],
  limit = 30
): Promise<Array<Reply & { postTitle: string | null }>> {
  if (nullifiers.length === 0) return []

  const condition = nullifiers.length === 1
    ? or(eq(replies.authorNullifier, nullifiers[0]!), eq(replies.nullifierHash, nullifiers[0]!))!
    : or(inArray(replies.authorNullifier, nullifiers), inArray(replies.nullifierHash, nullifiers))!

  const rows = await db
    .select({
      reply: replies,
      postTitle: posts.title,
    })
    .from(replies)
    .innerJoin(posts, eq(replies.postId, posts.id))
    .where(condition)
    .orderBy(desc(replies.createdAt))
    .limit(Math.min(limit, 50))

  return rows.map(({ reply, postTitle }) => ({
    ...toReply(reply),
    postTitle: postTitle ?? null,
  }))
}
