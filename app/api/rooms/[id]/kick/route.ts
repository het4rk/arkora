import { NextRequest, NextResponse } from 'next/server'
import { kickParticipant } from '@/lib/db/rooms'
import { getCallerNullifier } from '@/lib/serverAuth'
import { pusherServer } from '@/lib/pusher'

// POST /api/rooms/[id]/kick
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const callerHash = await getCallerNullifier()
    if (!callerHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = (await req.json()) as { targetHash?: string }

    if (!body.targetHash) {
      return NextResponse.json({ success: false, error: 'targetHash required' }, { status: 400 })
    }

    const success = await kickParticipant(id, body.targetHash, callerHash)

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Not authorized or participant not found' },
        { status: 403 }
      )
    }

    await pusherServer.trigger(`presence-room-${id}`, 'participant-kicked', {
      targetHash: body.targetHash,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[rooms/[id]/kick POST]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Failed to kick participant' }, { status: 500 })
  }
}
