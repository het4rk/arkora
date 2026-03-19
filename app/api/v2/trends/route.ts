import { NextRequest, NextResponse } from 'next/server'
import { requirePremiumAuth, V2_CORS_HEADERS } from '@/lib/agentAuth'
import { getTrends, isValidWindow } from '@/lib/db/analytics'

/**
 * GET /api/v2/trends?limit=10&window=24h
 *
 * AgentKit-only premium endpoint.
 * Trending boards/topics ranked by post velocity delta.
 * Compares post volume in current window vs previous window.
 *
 * Auth: AgentKit proof-of-human required. 50 free requests/day per human,
 * then x402 micropayment ($0.001/req USDC on World Chain).
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: V2_CORS_HEADERS })
}

export async function GET(req: NextRequest) {
  const auth = await requirePremiumAuth(req, 'v2/trends')
  if (auth instanceof NextResponse) return auth

  const { searchParams } = req.nextUrl
  const window = searchParams.get('window') ?? '24h'
  const limitRaw = parseInt(searchParams.get('limit') ?? '10', 10)
  const limit = Math.min(Math.max(1, isNaN(limitRaw) ? 10 : limitRaw), 50)

  if (!isValidWindow(window)) {
    return NextResponse.json(
      { success: false, error: 'window must be 24h, 7d, or 30d' },
      { status: 400, headers: V2_CORS_HEADERS }
    )
  }

  try {
    const data = await getTrends(limit, window)
    return NextResponse.json({ success: true, data }, { headers: V2_CORS_HEADERS })
  } catch (err) {
    console.error('[v2/trends GET]', err instanceof Error ? err.message : String(err))
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: V2_CORS_HEADERS }
    )
  }
}
