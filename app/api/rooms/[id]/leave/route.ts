import { NextRequest, NextResponse } from 'next/server'
import { leaveRoom } from '@/lib/db/rooms'
import { getCallerNullifier } from '@/lib/serverAuth'

// POST /api/rooms/[id]/leave
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const callerHash = await getCallerNullifier()
    if (!callerHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    await leaveRoom(id, callerHash)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[rooms/[id]/leave POST]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Failed to leave room' }, { status: 500 })
  }
}
