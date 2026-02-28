import { NextRequest, NextResponse } from 'next/server'
import { getCallerNullifier } from '@/lib/serverAuth'
import { getParticipant } from '@/lib/db/rooms'
import { AccessToken } from 'livekit-server-sdk'

/**
 * POST /api/rooms/[id]/voice-token
 * Generates a LiveKit JWT for joining the voice channel of this room.
 * Requires the caller to be an active participant (not muted by host for voice).
 *
 * Env vars required:
 *   LIVEKIT_API_KEY     - from LiveKit Cloud dashboard
 *   LIVEKIT_API_SECRET  - from LiveKit Cloud dashboard
 *   NEXT_PUBLIC_LIVEKIT_URL - wss://your-project.livekit.cloud
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  if (!apiKey || !apiSecret) {
    return NextResponse.json({ success: false, error: 'Voice not configured' }, { status: 503 })
  }

  const callerHash = await getCallerNullifier()
  if (!callerHash) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const participant = await getParticipant(id, callerHash)
  if (!participant) {
    return NextResponse.json({ success: false, error: 'You are not in this room' }, { status: 403 })
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: callerHash,
    name: participant.displayHandle,
    ttl: 60 * 60 * 2, // 2 hours - matches room TTL
  })

  at.addGrant({
    room: `arkora-${id}`,
    roomJoin: true,
    canPublish: !participant.isMuted, // host-muted = no publish
    canSubscribe: true,
    canPublishData: false,
  })

  const token = await at.toJwt()
  return NextResponse.json({ success: true, data: { token } })
}
