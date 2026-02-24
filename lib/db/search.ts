import { db } from './index'
import { posts } from './schema'
import { sql, ilike, or, and, isNull } from 'drizzle-orm'
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
    deletedAt: row.deletedAt ?? null,
    quotedPostId: row.quotedPostId ?? null,
    quotedPost: null,
  }
}

/**
 * Full-text search across post title, body, alias (pseudoHandle), and board.
 *
 * Uses PostgreSQL's native tsvector/tsquery for ranked relevance.
 * Falls back to a fast ILIKE scan so short single-token queries (< 3 chars)
 * still get results — tsquery needs at least one lexeme.
 */
export async function searchPosts(query: string, limit = 20): Promise<Post[]> {
  const q = query.trim().slice(0, 200)
  if (!q) return []

  // For very short queries use ILIKE — tsvector strips short tokens
  if (q.length < 3) {
    const pattern = `%${q}%`
    const rows = await db
      .select()
      .from(posts)
      .where(
        and(
          isNull(posts.deletedAt),
          or(
            ilike(posts.title, pattern),
            ilike(posts.pseudoHandle, pattern),
            ilike(posts.boardId, pattern)
          )
        )
      )
      .limit(limit)
    return rows.map(toPost)
  }

  // Full-text search with relevance ranking
  const rows = await db.execute<typeof posts.$inferSelect>(sql`
    SELECT *
    FROM posts
    WHERE
      deleted_at IS NULL
      AND to_tsvector('english',
        title || ' ' || body || ' ' ||
        COALESCE(pseudo_handle, '') || ' ' || board_id
      ) @@ websearch_to_tsquery('english', ${q})
    ORDER BY
      ts_rank(
        to_tsvector('english',
          title || ' ' || body || ' ' ||
          COALESCE(pseudo_handle, '') || ' ' || board_id
        ),
        websearch_to_tsquery('english', ${q})
      ) DESC,
      created_at DESC
    LIMIT ${limit}
  `)

  return (rows as unknown as Array<typeof posts.$inferSelect>).map(toPost)
}
