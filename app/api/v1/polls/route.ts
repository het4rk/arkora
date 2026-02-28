import { NextRequest, NextResponse } from 'next/server'
import { requireApiKey, CORS_HEADERS } from '@/lib/apiKeyAuth'
import { rateLimit } from '@/lib/rateLimit'
import { db } from '@/lib/db'
import { posts, pollVotes } from '@/lib/db/schema'
import { eq, and, lt, isNull, desc, sql, inArray } from 'drizzle-orm'

/**
 * GET /api/v1/polls
 * Returns verified-human polls with live vote totals per option.
 * Each vote is sybil-resistant - one per World ID-verified human per poll.
 *
 * Query params:
 *   boardId  - filter by board slug
 *   active   - "true" to return only polls that have not ended
 *   limit    - 1-50 (default 20)
 *   cursor   - pagination cursor (ISO date string from previous response)
 *
 * Auth: X-API-Key header (or Authorization: Bearer <key>)
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(req: NextRequest) {
  const auth = await requireApiKey(req)
  if (auth instanceof NextResponse) return auth

  if (!rateLimit(`v1polls:${auth.key.slice(0, 20)}`, 120, 60_000)) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429, headers: CORS_HEADERS }
    )
  }

  const { searchParams } = req.nextUrl
  const boardId = searchParams.get('boardId')
  const activeOnly = searchParams.get('active') === 'true'
  const cursor = searchParams.get('cursor')
  const limitRaw = parseInt(searchParams.get('limit') ?? '20', 10)
  const limit = Math.min(Math.max(1, isNaN(limitRaw) ? 20 : limitRaw), 50)

  const conditions = [
    eq(posts.type, 'poll'),
    isNull(posts.deletedAt),
    sql`${posts.reportCount} < 5`,
  ]

  if (boardId) conditions.push(eq(posts.boardId, boardId))
  if (activeOnly) conditions.push(sql`${posts.pollEndsAt} > now()`)
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
        imageUrl: posts.imageUrl,
        upvotes: posts.upvotes,
        downvotes: posts.downvotes,
        replyCount: posts.replyCount,
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
    const page = rows.slice(0, limit)

    // Batch-fetch vote counts for all polls on this page in one query
    const pollIds = page.map((r) => r.id)
    let voteCounts: { postId: string; optionIndex: number; count: number }[] = []

    if (pollIds.length > 0) {
      const voteRows = await db
        .select({
          postId: pollVotes.postId,
          optionIndex: pollVotes.optionIndex,
          count: sql<number>`count(*)::int`,
        })
        .from(pollVotes)
        .where(inArray(pollVotes.postId, pollIds))
        .groupBy(pollVotes.postId, pollVotes.optionIndex)
      voteCounts = voteRows
    }

    const items = page.map((r) => {
      const options = (r.pollOptions ?? []).map((opt) => {
        const votes =
          voteCounts.find((v) => v.postId === r.id && v.optionIndex === opt.index)?.count ?? 0
        return { index: opt.index, text: opt.text, votes }
      })
      const totalVotes = options.reduce((sum, o) => sum + o.votes, 0)
      const ended = r.pollEndsAt ? r.pollEndsAt < new Date() : false

      return {
        id: r.id,
        title: r.title,
        body: r.body,
        boardId: r.boardId,
        imageUrl: r.imageUrl ?? null,
        upvotes: r.upvotes,
        downvotes: r.downvotes,
        replyCount: r.replyCount,
        viewCount: r.viewCount,
        createdAt: r.createdAt,
        countryCode: r.countryCode ?? null,
        pollEndsAt: r.pollEndsAt?.toISOString() ?? null,
        pollEnded: ended,
        totalVotes,
        options,
        author: {
          handle: r.pseudoHandle ?? null,
          isVerified: true,
        },
      }
    })

    const nextCursor =
      hasMore && items.length > 0
        ? items[items.length - 1]!.createdAt.toISOString()
        : null

    return NextResponse.json(
      { success: true, data: items, nextCursor },
      { headers: CORS_HEADERS }
    )
  } catch (err) {
    console.error('[v1/polls GET]', err instanceof Error ? err.message : String(err))
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
