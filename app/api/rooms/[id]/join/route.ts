import { NextRequest, NextResponse } from 'next/server'
import { getRoom, joinRoom } from '@/lib/db/rooms'
import { getCallerNullifier } from '@/lib/serverAuth'
import { isVerifiedHuman } from '@/lib/db/users'
import { sanitizeLine } from '@/lib/sanitize'

// POST /api/rooms/[id]/join
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const callerHash = await getCallerNullifier()
    if (!callerHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const verified = await isVerifiedHuman(callerHash)
    if (!verified) {
      return NextResponse.json({ success: false, error: 'World ID verification required' }, { status: 403 })
    }

    const { id } = await params
    const room = await getRoom(id)

    if (!room) {
      return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 })
    }
    if (!room.isLive) {
      return NextResponse.json({ success: false, error: 'Room has ended' }, { status: 410 })
    }
    if (room.participantCount !== undefined && room.participantCount >= room.maxParticipants) {
      return NextResponse.json({ success: false, error: 'Room is full' }, { status: 409 })
    }

    const body = (await req.json()) as {
      displayHandle?: string
      identityMode?: string
    }

    const { displayHandle: rawHandle, identityMode: rawMode } = body

    if (!rawHandle?.trim()) {
      return NextResponse.json({ success: false, error: 'Display handle required' }, { status: 400 })
    }

    const validModes = ['anonymous', 'alias', 'named'] as const
    const identityMode = validModes.includes(rawMode as typeof validModes[number])
      ? (rawMode as typeof validModes[number])
      : 'anonymous'

    const displayHandle = sanitizeLine(rawHandle).slice(0, 50)
    const participant = await joinRoom(id, callerHash, displayHandle, identityMode)

    return NextResponse.json({ success: true, data: participant })
  } catch (err) {
    console.error('[rooms/[id]/join POST]', err)
    return NextResponse.json({ success: false, error: 'Failed to join room' }, { status: 500 })
  }
}
