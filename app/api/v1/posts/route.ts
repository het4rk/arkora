import { NextRequest, NextResponse } from 'next/server'
import { requireApiKey, CORS_HEADERS } from '@/lib/apiKeyAuth'
import { rateLimit } from '@/lib/rateLimit'
import { db } from '@/lib/db'
import { posts } from '@/lib/db/schema'
import { eq, and, lt, isNull, desc, sql } from 'drizzle-orm'

/**
 * GET /api/v1/posts
 * Returns verified-human posts. All data comes from World ID-verified accounts.
 *
 * Query params:
 *   boardId  - filter by board slug (e.g. "politics", "ai")
 *   type     - "text" | "poll" | "repost"
 *   limit    - 1-50 (default 20)
 *   cursor   - pagination cursor (ISO date string from previous response)
 *
 * Auth: X-API-Key header (or Authorization: Bearer <key>)
 *
 * Privacy: nullifierHash and walletAddress are never returned.
 *          Lat/lng are never returned. author.handle is the user's chosen display name or null.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(req: NextRequest) {
  const auth = await requireApiKey(req)
  if (auth instanceof NextResponse) return auth

  if (!rateLimit(`v1posts:${auth.key.slice(0, 20)}`, 120, 60_000)) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429, headers: CORS_HEADERS }
    )
  }

  const { searchParams } = req.nextUrl
  const boardId = searchParams.get('boardId')
  const type = searchParams.get('type')
  const cursor = searchParams.get('cursor')
  const limitRaw = parseInt(searchParams.get('limit') ?? '20', 10)
  const limit = Math.min(Math.max(1, isNaN(limitRaw) ? 20 : limitRaw), 50)

  const conditions = [
    isNull(posts.deletedAt),
    sql`${posts.reportCount} < 5`,
  ]

  if (boardId) conditions.push(eq(posts.boardId, boardId))
  if (type && ['text', 'poll', 'repost'].includes(type)) {
    conditions.push(eq(posts.type, type as 'text' | 'poll' | 'repost'))
  }
  if (cursor) {
    const cursorDate = new Date(cursor)
    if (!isNaN(cursorDate.getTime())) conditions.push(lt(posts.createdAt, cursorDate))
  }

  try {
    const rows = await db
      .select({
        id: posts.id,
        title: posts.title,
        body: posts.body,
        boardId: posts.boardId,
        type: posts.type,
        imageUrl: posts.imageUrl,
        upvotes: posts.upvotes,
        downvotes: posts.downvotes,
        replyCount: posts.replyCount,
        quoteCount: posts.quoteCount,
        viewCount: posts.viewCount,
        createdAt: posts.createdAt,
        countryCode: posts.countryCode,
        pollOptions: posts.pollOptions,
        pollEndsAt: posts.pollEndsAt,
        pseudoHandle: posts.pseudoHandle,
      })
      .from(posts)
      .where(and(...conditions))
      .orderBy(desc(posts.createdAt))
      .limit(limit + 1)

    const hasMore = rows.length > limit
    const items = rows.slice(0, limit).map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      boardId: r.boardId,
      type: r.type,
      imageUrl: r.imageUrl ?? null,
      upvotes: r.upvotes,
      downvotes: r.downvotes,
      replyCount: r.replyCount,
      quoteCount: r.quoteCount,
      viewCount: r.viewCount,
      createdAt: r.createdAt,
      countryCode: r.countryCode ?? null,
      pollOptions: r.type === 'poll' ? (r.pollOptions ?? null) : null,
      pollEndsAt: r.type === 'poll' ? (r.pollEndsAt?.toISOString() ?? null) : null,
      author: {
        handle: r.pseudoHandle ?? null,
        isVerified: true,
      },
    }))

    const nextCursor =
      hasMore && items.length > 0
        ? items[items.length - 1]!.createdAt.toISOString()
        : null

    return NextResponse.json(
      { success: true, data: items, nextCursor },
      { headers: CORS_HEADERS }
    )
  } catch (err) {
    console.error('[v1/posts GET]', err instanceof Error ? err.message : String(err))
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
