import { NextRequest, NextResponse } from 'next/server'
import { muteParticipant } from '@/lib/db/rooms'
import { getCallerNullifier } from '@/lib/serverAuth'
import { rateLimit } from '@/lib/rateLimit'
import { pusherServer } from '@/lib/pusher'

// POST /api/rooms/[id]/mute
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

    if (!rateLimit(`room-mute:${id}:${callerHash}`, 10, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
    }
    const body = (await req.json()) as { targetHash?: string }

    if (!body.targetHash) {
      return NextResponse.json({ success: false, error: 'targetHash required' }, { status: 400 })
    }

    const success = await muteParticipant(id, body.targetHash, callerHash)

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Not authorized or participant not found' },
        { status: 403 }
      )
    }

    await pusherServer.trigger(`presence-room-${id}`, 'participant-muted', {
      targetHash: body.targetHash,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[rooms/[id]/mute POST]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Failed to mute participant' }, { status: 500 })
  }
}
