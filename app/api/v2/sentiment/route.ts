import { NextRequest, NextResponse } from 'next/server'
import { requirePremiumAuth, V2_CORS_HEADERS } from '@/lib/agentAuth'
import { getSentiment, isValidWindow } from '@/lib/db/analytics'

/**
 * GET /api/v2/sentiment?boardId=X&window=24h|7d|30d
 *
 * AgentKit-only premium endpoint.
 * Aggregates upvote/downvote ratios per board over time windows.
 * Returns sentiment score (0-1 scale) and volume metrics.
 *
 * Auth: AgentKit proof-of-human required. 50 free requests/day per human,
 * then x402 micropayment ($0.001/req USDC on World Chain).
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: V2_CORS_HEADERS })
}

export async function GET(req: NextRequest) {
  const auth = await requirePremiumAuth(req, 'v2/sentiment')
  if (auth instanceof NextResponse) return auth

  const { searchParams } = req.nextUrl
  const boardId = searchParams.get('boardId')
  const window = searchParams.get('window') ?? '24h'

  if (!boardId) {
    return NextResponse.json(
      { success: false, error: 'boardId parameter required' },
      { status: 400, headers: V2_CORS_HEADERS }
    )
  }

  if (!isValidWindow(window)) {
    return NextResponse.json(
      { success: false, error: 'window must be 24h, 7d, or 30d' },
      { status: 400, headers: V2_CORS_HEADERS }
    )
  }

  try {
    const data = await getSentiment(boardId, window)
    return NextResponse.json({ success: true, data }, { headers: V2_CORS_HEADERS })
  } catch (err) {
    console.error('[v2/sentiment GET]', err instanceof Error ? err.message : String(err))
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: V2_CORS_HEADERS }
    )
  }
}
