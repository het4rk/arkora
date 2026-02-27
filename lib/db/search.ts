import { db } from './index'
import { posts } from './schema'
import { sql, ilike, or, desc } from 'drizzle-orm'
import type { Post, BoardId } from '@/lib/types'

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
    quoteCount: row.quoteCount,
    createdAt: row.createdAt,
    quotedPostId: row.quotedPostId ?? null,
    quotedPost: null,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    countryCode: row.countryCode ?? null,
    type: (row.type as 'text' | 'poll' | 'repost') ?? 'text',
    pollOptions: (row.pollOptions as { index: number; text: string }[] | null) ?? null,
    pollEndsAt: row.pollEndsAt ?? null,
    contentHash: row.contentHash ?? null,
  }
}

/**
 * Full-text search across post title, body, alias (pseudoHandle), and board.
 *
 * Uses PostgreSQL's native tsvector/tsquery for ranked relevance.
 * Falls back to a fast ILIKE scan so short single-token queries (< 3 chars)
 * still get results - tsquery needs at least one lexeme.
 */
export async function searchPosts(query: string, limit = 20): Promise<Post[]> {
  limit = Math.min(limit, 50)
  const q = query.trim().slice(0, 200)
  if (!q) return []

  // For very short queries use ILIKE - tsvector strips short tokens
  if (q.length < 3) {
    const pattern = `%${q}%`
    const rows = await db
      .select()
      .from(posts)
      .where(
        or(
          ilike(posts.title, pattern),
          ilike(posts.pseudoHandle, pattern),
          ilike(posts.boardId, pattern)
        )
      )
      .limit(limit)
    return rows.map(toPost)
  }

  // Full-text search with relevance ranking.
  // Uses db.select() so Drizzle maps snake_case columns to camelCase fields.
  const tsVector = sql`to_tsvector('english', title || ' ' || body || ' ' || COALESCE(pseudo_handle, '') || ' ' || board_id)`
  const tsQuery = sql`websearch_to_tsquery('english', ${q})`

  const rows = await db
    .select()
    .from(posts)
    .where(sql`${tsVector} @@ ${tsQuery}`)
    .orderBy(sql`ts_rank(${tsVector}, ${tsQuery}) DESC`, desc(posts.createdAt))
    .limit(limit)

  return rows.map(toPost)
}
