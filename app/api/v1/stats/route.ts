import { NextRequest, NextResponse } from 'next/server'
import { requireApiKey, CORS_HEADERS } from '@/lib/apiKeyAuth'
import { rateLimit } from '@/lib/rateLimit'
import { db } from '@/lib/db'
import { posts, humanUsers, pollVotes } from '@/lib/db/schema'
import { eq, isNull, sql } from 'drizzle-orm'

/**
 * GET /api/v1/stats
 * Returns aggregate platform stats.
 *
 * Response:
 *   totalPosts         - all non-deleted posts
 *   totalPolls         - all non-deleted polls
 *   totalVerifiedHumans - World ID-verified user count
 *   totalPollVotes     - total poll votes cast (sybil-resistant: 1 per human per poll)
 *
 * Auth: X-API-Key header (or Authorization: Bearer <key>)
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(req: NextRequest) {
  const auth = await requireApiKey(req)
  if (auth instanceof NextResponse) return auth

  if (!rateLimit(`v1stats:${auth.key.slice(0, 20)}`, 30, 60_000)) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429, headers: CORS_HEADERS }
    )
  }

  try {
    const [postRow, pollRow, userRow, voteRow] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(posts)
        .where(isNull(posts.deletedAt)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(posts)
        .where(sql`${posts.type} = 'poll' AND ${posts.deletedAt} IS NULL`),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(humanUsers)
        .where(eq(humanUsers.worldIdVerified, true)),
      db.select({ count: sql<number>`count(*)::int` }).from(pollVotes),
    ])

    return NextResponse.json(
      {
        success: true,
        data: {
          totalPosts: postRow[0]?.count ?? 0,
          totalPolls: pollRow[0]?.count ?? 0,
          totalVerifiedHumans: userRow[0]?.count ?? 0,
          totalPollVotes: voteRow[0]?.count ?? 0,
        },
      },
      { headers: CORS_HEADERS }
    )
  } catch (err) {
    console.error('[v1/stats GET]', err instanceof Error ? err.message : String(err))
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
