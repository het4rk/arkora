import { NextRequest, NextResponse } from 'next/server'
import { getCallerNullifier } from '@/lib/serverAuth'
import { getParticipant } from '@/lib/db/rooms'
import { pusherServer } from '@/lib/pusher'

/**
 * POST /api/pusher/auth
 *
 * Pusher presence channel authentication endpoint.
 * Called by pusher-js when subscribing to a `presence-room-*` channel.
 * Verifies the user is an active room participant and returns signed auth token.
 */
export async function POST(req: NextRequest) {
  try {
    const callerHash = await getCallerNullifier()
    if (!callerHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Pusher sends form-encoded body: socket_id + channel_name
    const formData = await req.formData()
    const socketId = formData.get('socket_id') as string | null
    const channel = formData.get('channel_name') as string | null

    if (!socketId || !channel) {
      return NextResponse.json({ success: false, error: 'Missing socket_id or channel_name' }, { status: 400 })
    }

    // Private user channels — DM and notification delivery
    if (channel.startsWith('private-user-')) {
      const channelHash = channel.replace('private-user-', '')
      // User can only subscribe to their own private channel
      if (channelHash !== callerHash) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
      }
      const authResponse = pusherServer.authorizeChannel(socketId, channel)
      return NextResponse.json(authResponse)
    }

    // Presence room channels
    if (!channel.startsWith('presence-room-')) {
      return NextResponse.json({ success: false, error: 'Invalid channel' }, { status: 400 })
    }

    const roomId = channel.replace('presence-room-', '')

    // Verify user is an active room participant
    const participant = await getParticipant(roomId, callerHash)
    if (!participant) {
      return NextResponse.json(
        { success: false, error: 'You are not in this room' },
        { status: 403 }
      )
    }

    const presenceData = {
      user_id: callerHash,
      user_info: {
        displayHandle: participant.displayHandle,
        identityMode: participant.identityMode,
        isMuted: participant.isMuted,
        isCoHost: participant.isCoHost,
      },
    }

    const authResponse = pusherServer.authorizeChannel(socketId, channel, presenceData)
    return NextResponse.json(authResponse)
  } catch (err) {
    console.error('[pusher/auth POST]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Auth failed' }, { status: 500 })
  }
}
