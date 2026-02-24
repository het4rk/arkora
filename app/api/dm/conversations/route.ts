import { NextRequest, NextResponse } from 'next/server'
import { getConversations } from '@/lib/db/dm'

// GET /api/dm/conversations?nullifierHash=xxx
export async function GET(req: NextRequest) {
  try {
    const nullifierHash = new URL(req.url).searchParams.get('nullifierHash')
    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'nullifierHash required' }, { status: 400 })
    }
    const conversations = await getConversations(nullifierHash)
    return NextResponse.json({ success: true, data: conversations })
  } catch (err) {
    console.error('[dm/conversations GET]', err)
    return NextResponse.json({ success: false, error: 'Failed to fetch conversations' }, { status: 500 })
  }
}
