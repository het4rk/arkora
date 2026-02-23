import { db } from './index'
import { replies } from './schema'
import { eq, desc, and } from 'drizzle-orm'
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
  const rows = await db
    .select()
    .from(replies)
    .where(and(eq(replies.postId, postId)))
    .orderBy(desc(replies.upvotes), desc(replies.createdAt))

  return rows.map(toReply)
}
