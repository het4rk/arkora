import { db } from './index'
import { posts, humanUsers } from './schema'
import { sql, ilike, or, desc } from 'drizzle-orm'
import type { Post, BoardId, BoardResult, PersonResult } from '@/lib/types'
import { FEATURED_BOARDS, boardLabel } from '@/lib/boards'

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
    viewCount: row.viewCount,
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

/**
 * Search boards by prefix-first matching.
 * Combines featured boards with user-created boards from DB,
 * prioritizes prefix matches over contains matches.
 */
export async function searchBoards(query: string, limit = 5): Promise<BoardResult[]> {
  limit = Math.min(limit, 20)
  const q = query.trim().toLowerCase().slice(0, 100)
  if (!q) return []

  // Get all boards with post counts from DB
  const dbRows = await db.execute<{ board_id: string; count: string }>(
    sql`SELECT board_id, COUNT(*)::text AS count
        FROM posts
        WHERE report_count < 5
        GROUP BY board_id
        ORDER BY COUNT(*) DESC`
  )

  // Build combined list: featured boards + any DB-only boards
  const countMap = new Map<string, number>()
  for (const row of dbRows) {
    countMap.set(row.board_id, parseInt(row.count, 10))
  }

  const allBoards: BoardResult[] = [
    ...FEATURED_BOARDS.map((b) => ({
      id: b.id,
      label: b.label,
      postCount: countMap.get(b.id) ?? 0,
    })),
  ]

  // Add user-created boards not in featured list
  const featuredIds = new Set(FEATURED_BOARDS.map((b) => b.id))
  for (const row of dbRows) {
    if (!featuredIds.has(row.board_id)) {
      allBoards.push({
        id: row.board_id,
        label: boardLabel(row.board_id),
        postCount: parseInt(row.count, 10),
      })
    }
  }

  // Prefix matches first, then contains matches
  const prefix: BoardResult[] = []
  const contains: BoardResult[] = []
  for (const b of allBoards) {
    if (b.id.startsWith(q) || b.label.toLowerCase().startsWith(q)) {
      prefix.push(b)
    } else if (b.id.includes(q) || b.label.toLowerCase().includes(q)) {
      contains.push(b)
    }
  }

  // Sort each group by post count descending
  prefix.sort((a, b) => b.postCount - a.postCount)
  contains.sort((a, b) => b.postCount - a.postCount)

  return [...prefix, ...contains].slice(0, limit)
}

/**
 * Search users by pseudoHandle with prefix-first matching.
 * Only returns users who have a visible handle set.
 */
export async function searchUsers(query: string, limit = 5): Promise<PersonResult[]> {
  limit = Math.min(limit, 20)
  const q = query.trim().slice(0, 100)
  if (!q) return []

  const prefixPattern = `${q}%`
  const containsPattern = `%${q}%`

  const rows = await db
    .select({
      nullifierHash: humanUsers.nullifierHash,
      pseudoHandle: humanUsers.pseudoHandle,
      avatarUrl: humanUsers.avatarUrl,
      karmaScore: humanUsers.karmaScore,
    })
    .from(humanUsers)
    .where(
      sql`${humanUsers.pseudoHandle} IS NOT NULL AND ${ilike(humanUsers.pseudoHandle, containsPattern)}`
    )
    .orderBy(
      sql`CASE WHEN ${humanUsers.pseudoHandle} ILIKE ${prefixPattern} THEN 0 ELSE 1 END`,
      desc(humanUsers.karmaScore)
    )
    .limit(limit)

  return rows.map((r) => ({
    nullifierHash: r.nullifierHash,
    pseudoHandle: r.pseudoHandle!,
    avatarUrl: r.avatarUrl ?? null,
    karmaScore: r.karmaScore,
  }))
}
