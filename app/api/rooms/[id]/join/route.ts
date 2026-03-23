import { NextRequest, NextResponse } from 'next/server'
import { getRoom, joinRoom } from '@/lib/db/rooms'
import { getCallerNullifier } from '@/lib/serverAuth'
import { isVerifiedHuman, getUserByNullifier } from '@/lib/db/users'
import { sanitizeLine } from '@/lib/sanitize'
import { rateLimit } from '@/lib/rateLimit'

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

    if (!(await rateLimit(`room-join:${callerHash}`, 10, 60_000))) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
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
    if ((room.participantCount ?? 0) >= room.maxParticipants) {
      return NextResponse.json({ success: false, error: 'Room is full' }, { status: 409 })
    }

    const body = (await req.json()) as {
      displayHandle?: string
    }

    const { displayHandle: rawHandle } = body

    if (!rawHandle?.trim()) {
      return NextResponse.json({ success: false, error: 'Display handle required' }, { status: 400 })
    }

    // Use the user's stored identity mode from DB - never trust client-supplied mode
    const user = await getUserByNullifier(callerHash)
    const identityMode = (user?.identityMode ?? 'anonymous') as 'anonymous' | 'alias' | 'named'

    const displayHandle = sanitizeLine(rawHandle).slice(0, 50)
    const participant = await joinRoom(id, callerHash, displayHandle, identityMode)

    return NextResponse.json({ success: true, data: participant })
  } catch (err) {
    console.error('[rooms/[id]/join POST]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Failed to join room' }, { status: 500 })
  }
}
