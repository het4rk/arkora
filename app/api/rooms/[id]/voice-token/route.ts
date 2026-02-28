import { NextRequest, NextResponse } from 'next/server'
import { getCallerNullifier } from '@/lib/serverAuth'
import { getParticipant } from '@/lib/db/rooms'
import { rateLimit } from '@/lib/rateLimit'
import { AccessToken } from 'livekit-server-sdk'

/**
 * POST /api/rooms/[id]/voice-token
 * Generates a LiveKit JWT for joining the voice channel of this room.
 * Requires the caller to be an active participant.
 *
 * Env vars required:
 *   LIVEKIT_API_KEY          - from LiveKit Cloud dashboard
 *   LIVEKIT_API_SECRET       - from LiveKit Cloud dashboard
 *   NEXT_PUBLIC_LIVEKIT_URL  - wss://your-project.livekit.cloud
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const apiKey = process.env.LIVEKIT_API_KEY
    const apiSecret = process.env.LIVEKIT_API_SECRET
    if (!apiKey || !apiSecret) {
      return NextResponse.json({ success: false, error: 'Voice not configured' }, { status: 503 })
    }

    const callerHash = await getCallerNullifier()
    if (!callerHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // 10 token requests per minute per user - prevents abuse
    if (!rateLimit(`voice-token:${callerHash}`, 10, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
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
      canPublish: !participant.isMuted, // host-muted = no audio publish
      canSubscribe: true,
      canPublishData: false,
    })

    const token = await at.toJwt()
    return NextResponse.json({ success: true, data: { token } })
  } catch (err) {
    console.error('[voice-token POST]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
