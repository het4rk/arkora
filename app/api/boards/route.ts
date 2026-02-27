import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { posts } from '@/lib/db/schema'
import { isNull, sql } from 'drizzle-orm'
import { FEATURED_BOARDS, boardLabel } from '@/lib/boards'

/**
 * GET /api/boards
 * Returns all known boards sorted by post activity.
 * Featured boards are always included; user-created boards appear after them.
 */
export async function GET() {
  try {
    // Get all distinct board IDs with post counts from the DB
    const rows = await db
      .select({
        id: posts.boardId,
        count: sql<number>`count(*)::int`,
      })
      .from(posts)
      .where(isNull(posts.deletedAt))
      .groupBy(posts.boardId)
      .orderBy(sql`count(*) desc`)

    const featuredIds = new Set(FEATURED_BOARDS.map((b) => b.id))

    // Merge: featured boards first (with real counts), then user-created boards
    const featuredWithCounts = FEATURED_BOARDS.map((board) => ({
      ...board,
      postCount: rows.find((r) => r.id === board.id)?.count ?? 0,
    }))

    const userCreated = rows
      .filter((r) => !featuredIds.has(r.id))
      .map((r) => ({
        id: r.id,
        label: boardLabel(r.id),
        emoji: '💬',
        postCount: r.count,
      }))

    return NextResponse.json({
      success: true,
      data: [...featuredWithCounts, ...userCreated],
    })
  } catch (err) {
    console.error('[boards/route]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
