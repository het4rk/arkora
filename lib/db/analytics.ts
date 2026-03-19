import { db } from '@/lib/db'
import { posts } from './schema'
import { and, eq, gte, isNull, sql, desc } from 'drizzle-orm'

type TimeWindow = '24h' | '7d' | '30d'

function windowToMs(window: TimeWindow): number {
  switch (window) {
    case '24h': return 24 * 60 * 60 * 1000
    case '7d': return 7 * 24 * 60 * 60 * 1000
    case '30d': return 30 * 24 * 60 * 60 * 1000
  }
}

export function isValidWindow(w: string | null): w is TimeWindow {
  return w === '24h' || w === '7d' || w === '30d'
}

/**
 * Aggregates upvote/downvote ratios for a board over a time window.
 * Returns sentiment score (0-1 scale) and volume.
 */
export async function getSentiment(boardId: string, window: TimeWindow) {
  const since = new Date(Date.now() - windowToMs(window))

  const conditions = [
    isNull(posts.deletedAt),
    sql`${posts.reportCount} < 5`,
    gte(posts.createdAt, since),
    eq(posts.boardId, boardId),
  ]

  const rows = await db
    .select({
      totalUpvotes: sql<number>`coalesce(sum(${posts.upvotes}), 0)::int`,
      totalDownvotes: sql<number>`coalesce(sum(${posts.downvotes}), 0)::int`,
      postCount: sql<number>`count(*)::int`,
    })
    .from(posts)
    .where(and(...conditions))

  const row = rows[0]
  const up = row?.totalUpvotes ?? 0
  const down = row?.totalDownvotes ?? 0
  const total = up + down
  const score = total > 0 ? up / total : 0.5

  return {
    boardId,
    window,
    score: Math.round(score * 1000) / 1000,
    volume: {
      posts: row?.postCount ?? 0,
      upvotes: up,
      downvotes: down,
      totalVotes: total,
    },
  }
}

/**
 * Trending boards/topics ranked by post velocity.
 * Compares posts-per-hour in current window vs previous window.
 */
export async function getTrends(limit: number, window: TimeWindow) {
  const windowMs = windowToMs(window)
  const now = Date.now()
  const currentStart = new Date(now - windowMs)
  const previousStart = new Date(now - windowMs * 2)

  const baseConditions = [
    isNull(posts.deletedAt),
    sql`${posts.reportCount} < 5`,
  ]

  // Current window counts by board
  const currentRows = await db
    .select({
      boardId: posts.boardId,
      count: sql<number>`count(*)::int`,
    })
    .from(posts)
    .where(and(...baseConditions, gte(posts.createdAt, currentStart)))
    .groupBy(posts.boardId)
    .orderBy(sql`count(*) desc`)
    .limit(limit * 2) // fetch extra to have room after velocity calc

  // Previous window counts for the same boards
  const boardIds = currentRows.map((r) => r.boardId)
  if (boardIds.length === 0) return []

  const previousRows = await db
    .select({
      boardId: posts.boardId,
      count: sql<number>`count(*)::int`,
    })
    .from(posts)
    .where(
      and(
        ...baseConditions,
        gte(posts.createdAt, previousStart),
        sql`${posts.createdAt} < ${currentStart}`,
        sql`${posts.boardId} = ANY(${boardIds})`
      )
    )
    .groupBy(posts.boardId)

  const prevMap = new Map(previousRows.map((r) => [r.boardId, r.count]))

  const trends = currentRows.map((r) => {
    const prev = prevMap.get(r.boardId) ?? 0
    const delta = prev > 0 ? (r.count - prev) / prev : r.count > 0 ? 1 : 0

    return {
      boardId: r.boardId,
      postCount: r.count,
      previousCount: prev,
      velocityDelta: Math.round(delta * 100) / 100,
    }
  })

  trends.sort((a, b) => b.velocityDelta - a.velocityDelta)

  return trends.slice(0, limit)
}

/**
 * Vote distribution by country code for a board.
 * Breaks down engagement patterns geographically.
 */
export async function getDemographics(boardId: string, window: TimeWindow) {
  const since = new Date(Date.now() - windowToMs(window))

  const rows = await db
    .select({
      countryCode: posts.countryCode,
      postCount: sql<number>`count(*)::int`,
      totalUpvotes: sql<number>`coalesce(sum(${posts.upvotes}), 0)::int`,
      totalDownvotes: sql<number>`coalesce(sum(${posts.downvotes}), 0)::int`,
    })
    .from(posts)
    .where(
      and(
        isNull(posts.deletedAt),
        sql`${posts.reportCount} < 5`,
        eq(posts.boardId, boardId),
        gte(posts.createdAt, since),
        sql`${posts.countryCode} IS NOT NULL`
      )
    )
    .groupBy(posts.countryCode)
    .orderBy(desc(sql`count(*)`))

  return rows.map((r) => ({
    countryCode: r.countryCode,
    postCount: r.postCount,
    upvotes: r.totalUpvotes,
    downvotes: r.totalDownvotes,
    totalVotes: r.totalUpvotes + r.totalDownvotes,
  }))
}
