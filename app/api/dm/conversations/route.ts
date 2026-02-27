import { NextRequest, NextResponse } from 'next/server'
import { getConversations } from '@/lib/db/dm'
import { getCallerNullifier } from '@/lib/serverAuth'
import { rateLimit } from '@/lib/rateLimit'

// GET /api/dm/conversations - returns conversations for the authenticated caller
export async function GET(req: NextRequest) {
  try {
    const nullifierHash = await getCallerNullifier()
    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const ip = req.headers.get('x-forwarded-for') ?? 'anon'
    if (!rateLimit(`dm-conv:${ip}`, 30, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
    }
    const conversations = await getConversations(nullifierHash)
    return NextResponse.json({ success: true, data: conversations })
  } catch (err) {
    console.error('[dm/conversations GET]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Failed to fetch conversations' }, { status: 500 })
  }
}
