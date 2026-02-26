import { NextResponse } from 'next/server'
import { getCallerNullifier } from '@/lib/serverAuth'
import { db } from '@/lib/db'
import { humanUsers, posts, replies, postVotes, rooms } from '@/lib/db/schema'
import { sql, and, gte, eq } from 'drizzle-orm'

// Hardcoded admin nullifier hashes (add yours here)
const ADMIN_HASHES = new Set<string>(
  (process.env.ADMIN_NULLIFIER_HASHES ?? '').split(',').filter(Boolean)
)

export async function GET() {
  try {
    const nullifierHash = await getCallerNullifier()
    if (!nullifierHash || !ADMIN_HASHES.has(nullifierHash)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [
      totalUsersRow,
      verifiedUsersRow,
      dauRow,
      mauRow,
      postsLast24hRow,
      postsLast7dRow,
      activeRoomsRow,
      boardBreakdownRows,
    ] = await Promise.all([
      // Total users
      db.select({ count: sql<number>`count(*)` }).from(humanUsers),

      // World ID verified humans
      db
        .select({ count: sql<number>`count(*)` })
        .from(humanUsers)
        .where(eq(humanUsers.worldIdVerified, true)),

      // DAU: unique nullifiers that posted, replied, or voted in last 24h
      db.execute(sql`
        SELECT count(DISTINCT nh) AS count FROM (
          SELECT nullifier_hash AS nh FROM posts WHERE created_at >= ${oneDayAgo} AND deleted_at IS NULL
          UNION ALL
          SELECT nullifier_hash AS nh FROM replies WHERE created_at >= ${oneDayAgo} AND deleted_at IS NULL
          UNION ALL
          SELECT nullifier_hash AS nh FROM post_votes WHERE created_at >= ${oneDayAgo}
        ) sub
      `),

      // MAU: same but last 30 days
      db.execute(sql`
        SELECT count(DISTINCT nh) AS count FROM (
          SELECT nullifier_hash AS nh FROM posts WHERE created_at >= ${thirtyDaysAgo} AND deleted_at IS NULL
          UNION ALL
          SELECT nullifier_hash AS nh FROM replies WHERE created_at >= ${thirtyDaysAgo} AND deleted_at IS NULL
          UNION ALL
          SELECT nullifier_hash AS nh FROM post_votes WHERE created_at >= ${thirtyDaysAgo}
        ) sub
      `),

      // Posts in last 24h
      db
        .select({ count: sql<number>`count(*)` })
        .from(posts)
        .where(and(gte(posts.createdAt, oneDayAgo), sql`${posts.deletedAt} IS NULL`)),

      // Posts per day for last 7 days
      db.execute(sql`
        SELECT date_trunc('day', created_at) AS day, count(*) AS count
        FROM posts
        WHERE created_at >= ${sevenDaysAgo} AND deleted_at IS NULL
        GROUP BY day
        ORDER BY day DESC
      `),

      // Active rooms
      db
        .select({ count: sql<number>`count(*)` })
        .from(rooms)
        .where(and(eq(rooms.isLive, true), gte(rooms.endsAt, now))),

      // Board breakdown: posts per board (last 30 days)
      db.execute(sql`
        SELECT board_id, count(*) AS count
        FROM posts
        WHERE created_at >= ${thirtyDaysAgo} AND deleted_at IS NULL
        GROUP BY board_id
        ORDER BY count DESC
      `),
    ])

    type CountRow = { count: string | number }
    type DayRow = { day: string; count: string | number }
    type BoardRow = { board_id: string; count: string | number }

    const dauRows = (dauRow as unknown) as CountRow[]
    const mauRows = (mauRow as unknown) as CountRow[]
    const last7dRows = (postsLast7dRow as unknown) as DayRow[]
    const boardRows = (boardBreakdownRows as unknown) as BoardRow[]

    return NextResponse.json({
      success: true,
      data: {
        totalUsers: Number(totalUsersRow[0]?.count ?? 0),
        verifiedHumans: Number(verifiedUsersRow[0]?.count ?? 0),
        dau: Number(dauRows[0]?.count ?? 0),
        mau: Number(mauRows[0]?.count ?? 0),
        postsLast24h: Number(postsLast24hRow[0]?.count ?? 0),
        postsLast7d: last7dRows.map((r) => ({ day: r.day, count: Number(r.count) })),
        activeRooms: Number(activeRoomsRow[0]?.count ?? 0),
        boardBreakdown: boardRows.map((r) => ({ boardId: r.board_id, count: Number(r.count) })),
        generatedAt: now.toISOString(),
      },
    })
  } catch (err) {
    console.error('[GET /api/admin/metrics]', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
