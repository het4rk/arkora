import { NextRequest, NextResponse } from 'next/server'
import { getRoom, endRoom, getActiveParticipants } from '@/lib/db/rooms'
import { getCallerNullifier } from '@/lib/serverAuth'
import { pusherServer } from '@/lib/pusher'

// GET /api/rooms/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const room = await getRoom(id)

    if (!room) {
      return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 })
    }

    const participants = await getActiveParticipants(id)
    return NextResponse.json({ success: true, data: { room, participants } })
  } catch (err) {
    console.error('[rooms/[id] GET]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Failed to fetch room' }, { status: 500 })
  }
}

// DELETE /api/rooms/[id] - host ends the room
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const callerHash = await getCallerNullifier()
    if (!callerHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const ended = await endRoom(id, callerHash)

    if (!ended) {
      return NextResponse.json(
        { success: false, error: 'Room not found or you are not the host' },
        { status: 403 }
      )
    }

    // Notify all participants the room ended
    await pusherServer.trigger(`presence-room-${id}`, 'room-ended', {})

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[rooms/[id] DELETE]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Failed to end room' }, { status: 500 })
  }
}
