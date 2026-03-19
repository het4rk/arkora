import { NextRequest, NextResponse } from 'next/server'
import { requireV2Auth, V2_CORS_HEADERS } from '@/lib/agentAuth'
import { rateLimitAsync } from '@/lib/rateLimit'
import { db } from '@/lib/db'
import { posts, humanUsers, pollVotes } from '@/lib/db/schema'
import { eq, isNull, sql } from 'drizzle-orm'

/**
 * GET /api/v2/stats
 * Same as v1/stats but with dual auth (AgentKit + API key fallback).
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: V2_CORS_HEADERS })
}

export async function GET(req: NextRequest) {
  const auth = await requireV2Auth(req)
  if (auth instanceof NextResponse) return auth

  const rateLimit_ = auth.authType === 'agentkit' ? 60 : 30
  const allowed = await rateLimitAsync(`v2stats:${auth.key}`, rateLimit_, 60_000)
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429, headers: V2_CORS_HEADERS }
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
      { headers: V2_CORS_HEADERS }
    )
  } catch (err) {
    console.error('[v2/stats GET]', err instanceof Error ? err.message : String(err))
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: V2_CORS_HEADERS }
    )
  }
}
