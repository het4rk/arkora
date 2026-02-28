import { NextRequest, NextResponse } from 'next/server'
import { requireApiKey, CORS_HEADERS } from '@/lib/apiKeyAuth'
import { rateLimit } from '@/lib/rateLimit'
import { db } from '@/lib/db'
import { posts } from '@/lib/db/schema'
import { isNull, sql } from 'drizzle-orm'
import { FEATURED_BOARDS, boardLabel } from '@/lib/boards'

/**
 * GET /api/v1/boards
 * Returns all boards sorted by post count. Featured boards always included.
 *
 * Auth: X-API-Key header (or Authorization: Bearer <key>)
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(req: NextRequest) {
  const auth = await requireApiKey(req)
  if (auth instanceof NextResponse) return auth

  if (!rateLimit(`v1boards:${auth.key.slice(0, 20)}`, 60, 60_000)) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429, headers: CORS_HEADERS }
    )
  }

  try {
    const rows = await db
      .select({
        id: posts.boardId,
        postCount: sql<number>`count(*)::int`,
      })
      .from(posts)
      .where(isNull(posts.deletedAt))
      .groupBy(posts.boardId)
      .orderBy(sql`count(*) desc`)

    const featuredIds = new Set(FEATURED_BOARDS.map((b) => b.id))

    const featuredWithCounts = FEATURED_BOARDS.map((board) => ({
      id: board.id,
      label: board.label,
      postCount: rows.find((r) => r.id === board.id)?.postCount ?? 0,
    }))

    const userCreated = rows
      .filter((r) => !featuredIds.has(r.id))
      .map((r) => ({
        id: r.id,
        label: boardLabel(r.id),
        postCount: r.postCount,
      }))

    return NextResponse.json(
      { success: true, data: [...featuredWithCounts, ...userCreated] },
      { headers: CORS_HEADERS }
    )
  } catch (err) {
    console.error('[v1/boards GET]', err instanceof Error ? err.message : String(err))
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
