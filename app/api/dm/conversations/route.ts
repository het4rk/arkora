import { NextResponse } from 'next/server'
import { getConversations } from '@/lib/db/dm'
import { getCallerNullifier } from '@/lib/serverAuth'

// GET /api/dm/conversations — returns conversations for the authenticated caller
export async function GET() {
  try {
    const nullifierHash = await getCallerNullifier()
    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const conversations = await getConversations(nullifierHash)
    return NextResponse.json({ success: true, data: conversations })
  } catch (err) {
    console.error('[dm/conversations GET]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Failed to fetch conversations' }, { status: 500 })
  }
}
