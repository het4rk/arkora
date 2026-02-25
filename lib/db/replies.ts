import { db } from './index'
import { replies, replyVotes, posts } from './schema'
import { eq, desc, and, isNull, sql } from 'drizzle-orm'
import type { Reply, CreateReplyInput } from '@/lib/types'
import { generateSessionTag } from '@/lib/session'
import { incrementReplyCount } from './posts'

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
    deletedAt: row.deletedAt ?? null,
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
    })
    .returning()

  if (!row) throw new Error('Failed to create reply')
  await incrementReplyCount(input.postId)
  return toReply(row)
}

export async function getRepliesByPostId(postId: string): Promise<Reply[]> {
  // Return replies including deleted ones so thread tree stays intact.
  // UI renders deleted replies as tombstones. Cap at 500 as a safety valve.
  const rows = await db
    .select()
    .from(replies)
    .where(and(eq(replies.postId, postId)))
    .orderBy(desc(replies.upvotes), desc(replies.createdAt))
    .limit(500)

  return rows.map(toReply)
}

export async function softDeleteReply(replyId: string, nullifierHash: string): Promise<boolean> {
  const result = await db
    .update(replies)
    .set({ deletedAt: sql`now()` })
    .where(and(eq(replies.id, replyId), eq(replies.nullifierHash, nullifierHash)))
    .returning({ id: replies.id })

  return result.length > 0
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

/** Delete a reply vote and recount. Returns the updated vote counts. */
export async function deleteReplyVote(
  replyId: string,
  nullifierHash: string
): Promise<{ upvotes: number; downvotes: number }> {
  // Two separate statements so the COUNT(*) sees the post-DELETE state.
  // (CTE snapshot semantics would return a count that still includes the deleted row.)
  await db.execute(
    sql`DELETE FROM reply_votes WHERE reply_id = ${replyId} AND nullifier_hash = ${nullifierHash}`
  )
  const [row] = await db.execute<{ upvotes: number | string; downvotes: number | string }>(
    sql`UPDATE replies
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

/** Look up the nullifier hash of a reply's author. */
export async function getReplyNullifier(replyId: string): Promise<string | null> {
  const [row] = await db
    .select({ nullifierHash: replies.nullifierHash })
    .from(replies)
    .where(eq(replies.id, replyId))
    .limit(1)
  return row?.nullifierHash ?? null
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
    .where(and(eq(replies.nullifierHash, nullifierHash), isNull(replies.deletedAt)))
    .orderBy(desc(replies.createdAt))
    .limit(Math.min(limit, 50))

  return rows.map(({ reply, postTitle }) => ({
    ...toReply(reply),
    postTitle: postTitle ?? null,
  }))
}
