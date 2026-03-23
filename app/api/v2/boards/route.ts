import { NextRequest, NextResponse } from 'next/server'
import { requireV2Auth, V2_CORS_HEADERS } from '@/lib/agentAuth'
import { rateLimit as rateLimitFn } from '@/lib/rateLimit'
import { db } from '@/lib/db'
import { posts } from '@/lib/db/schema'
import { isNull, sql } from 'drizzle-orm'
import { FEATURED_BOARDS, boardLabel } from '@/lib/boards'

/**
 * GET /api/v2/boards
 * Same as v1/boards but with dual auth (AgentKit + API key fallback).
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: V2_CORS_HEADERS })
}

export async function GET(req: NextRequest) {
  const auth = await requireV2Auth(req)
  if (auth instanceof NextResponse) return auth

  const rateLimit_ = auth.authType === 'agentkit' ? 120 : 60
  const allowed = await rateLimitFn(`v2boards:${auth.key}`, rateLimit_, 60_000)
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429, headers: V2_CORS_HEADERS }
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
      { headers: V2_CORS_HEADERS }
    )
  } catch (err) {
    console.error('[v2/boards GET]', err instanceof Error ? err.message : String(err))
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: V2_CORS_HEADERS }
    )
  }
}
