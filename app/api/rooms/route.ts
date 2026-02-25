import { NextRequest, NextResponse } from 'next/server'
import { createRoom, getRooms } from '@/lib/db/rooms'
import { getCallerNullifier } from '@/lib/serverAuth'
import { rateLimit } from '@/lib/rateLimit'
import { sanitizeLine } from '@/lib/sanitize'
import { isVerifiedHuman } from '@/lib/db/users'
import { BOARDS } from '@/lib/types'
import type { BoardId } from '@/lib/types'

const VALID_BOARD_IDS = new Set(BOARDS.map((b) => b.id))

// GET /api/rooms?boardId=technology
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const rawBoardId = searchParams.get('boardId')
    const boardId = rawBoardId && VALID_BOARD_IDS.has(rawBoardId as BoardId)
      ? (rawBoardId as BoardId)
      : undefined

    const activeRooms = await getRooms(boardId)
    return NextResponse.json({ success: true, data: activeRooms })
  } catch (err) {
    console.error('[rooms GET]', err)
    return NextResponse.json({ success: false, error: 'Failed to fetch rooms' }, { status: 500 })
  }
}

// POST /api/rooms — create a room
export async function POST(req: NextRequest) {
  try {
    const callerHash = await getCallerNullifier()
    if (!callerHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const verified = await isVerifiedHuman(callerHash)
    if (!verified) {
      return NextResponse.json({ success: false, error: 'World ID verification required' }, { status: 403 })
    }

    // Rate limit: 2 room creations per 10 minutes
    if (!rateLimit(`room-create:${callerHash}`, 2, 10 * 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many rooms created. Try again later.' }, { status: 429 })
    }

    const body = (await req.json()) as {
      title?: string
      boardId?: string
      maxParticipants?: number
      hostHandle?: string
    }

    const { title: rawTitle, boardId: rawBoardId, maxParticipants: rawMax, hostHandle: rawHandle } = body

    if (!rawTitle?.trim() || !rawBoardId || !rawHandle?.trim()) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    if (!VALID_BOARD_IDS.has(rawBoardId as BoardId)) {
      return NextResponse.json({ success: false, error: 'Invalid board' }, { status: 400 })
    }

    const title = sanitizeLine(rawTitle).slice(0, 100)
    const hostHandle = sanitizeLine(rawHandle).slice(0, 50)
    const maxParticipants = Math.min(Math.max(rawMax ?? 50, 2), 200)

    const room = await createRoom(callerHash, hostHandle, title, rawBoardId as BoardId, maxParticipants)
    return NextResponse.json({ success: true, data: room }, { status: 201 })
  } catch (err) {
    console.error('[rooms POST]', err)
    return NextResponse.json({ success: false, error: 'Failed to create room' }, { status: 500 })
  }
}
