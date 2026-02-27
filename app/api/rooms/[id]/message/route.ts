import { NextRequest, NextResponse } from 'next/server'
import { getRoom, getParticipant, incrementMessageCount } from '@/lib/db/rooms'
import { getCallerNullifier } from '@/lib/serverAuth'
import { rateLimit } from '@/lib/rateLimit'
import { sanitizeText } from '@/lib/sanitize'
import { pusherServer } from '@/lib/pusher'
import { randomUUID } from 'crypto'

// POST /api/rooms/[id]/message — broadcast a message via Pusher (not stored in DB)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const callerHash = await getCallerNullifier()
    if (!callerHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limit: 30 messages per 60 seconds
    if (!rateLimit(`room-msg:${callerHash}`, 30, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many messages. Slow down.' }, { status: 429 })
    }

    const { id } = await params

    // Verify room is live
    const room = await getRoom(id)
    if (!room || !room.isLive) {
      return NextResponse.json({ success: false, error: 'Room not found or has ended' }, { status: 410 })
    }

    // Verify caller is an active participant
    const participant = await getParticipant(id, callerHash)
    if (!participant) {
      return NextResponse.json({ success: false, error: 'You are not in this room' }, { status: 403 })
    }

    if (participant.isMuted) {
      return NextResponse.json({ success: false, error: 'You are muted' }, { status: 403 })
    }

    const body = (await req.json()) as { text?: string }
    const rawText = body.text

    if (!rawText?.trim()) {
      return NextResponse.json({ success: false, error: 'Message text required' }, { status: 400 })
    }

    const text = sanitizeText(rawText).slice(0, 500)

    const message = {
      id: randomUUID(),
      senderHash: callerHash,
      displayHandle: participant.displayHandle,
      text,
      createdAt: new Date().toISOString(),
    }

    // Broadcast to all room participants via Pusher presence channel
    await pusherServer.trigger(`presence-room-${id}`, 'new-message', message)

    // Increment message count (async, don't await to keep response fast)
    void incrementMessageCount(id)

    return NextResponse.json({ success: true, data: message })
  } catch (err) {
    console.error('[rooms/[id]/message POST]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Failed to send message' }, { status: 500 })
  }
}
