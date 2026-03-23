import { NextRequest, NextResponse } from 'next/server'
import { requireApiKey, CORS_HEADERS } from '@/lib/apiKeyAuth'
import { rateLimit } from '@/lib/rateLimit'
import { getNullifierByKeyHash } from '@/lib/db/apiKeys'
import { getNotifications, getUnreadCount, markAllRead } from '@/lib/db/notifications'
import { getUsersByNullifiers } from '@/lib/db/users'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(req: NextRequest) {
  const auth = await requireApiKey(req)
  if (auth instanceof NextResponse) return auth

  if (!(await rateLimit(`v1notif:${auth.key}`, 30, 60_000))) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429, headers: CORS_HEADERS }
    )
  }

  try {
    const nullifierHash = await getNullifierByKeyHash(auth.key)
    if (!nullifierHash) {
      return NextResponse.json(
        { success: false, error: 'API key owner not found' },
        { status: 403, headers: CORS_HEADERS }
      )
    }

    const [notifs, unreadCount] = await Promise.all([
      getNotifications(nullifierHash, 30),
      getUnreadCount(nullifierHash),
    ])

    // Enrich with actor display names
    const actorHashes = notifs
      .map((n) => n.actorHash)
      .filter((h): h is string => h !== null)
    const uniqueHashes = [...new Set(actorHashes)]
    const actorMap = uniqueHashes.length > 0
      ? await getUsersByNullifiers(uniqueHashes)
      : new Map<string, { pseudoHandle: string | null }>()

    const enriched = notifs.map((n) => ({
      id: n.id,
      type: n.type,
      referenceId: n.referenceId,
      actorDisplay: n.actorHash ? (actorMap.get(n.actorHash)?.pseudoHandle ?? null) : null,
      read: n.read,
      createdAt: n.createdAt,
    }))

    return NextResponse.json(
      {
        success: true,
        data: {
          notifications: enriched,
          unreadCount,
        },
      },
      { headers: CORS_HEADERS }
    )
  } catch (err) {
    console.error('[v1/notifications GET]', err instanceof Error ? err.message : String(err))
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireApiKey(req)
  if (auth instanceof NextResponse) return auth

  if (!(await rateLimit(`v1notif:${auth.key}`, 30, 60_000))) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429, headers: CORS_HEADERS }
    )
  }

  try {
    const nullifierHash = await getNullifierByKeyHash(auth.key)
    if (!nullifierHash) {
      return NextResponse.json(
        { success: false, error: 'API key owner not found' },
        { status: 403, headers: CORS_HEADERS }
      )
    }

    await markAllRead(nullifierHash)

    return NextResponse.json(
      { success: true, data: null },
      { headers: CORS_HEADERS }
    )
  } catch (err) {
    console.error('[v1/notifications POST]', err instanceof Error ? err.message : String(err))
    return NextResponse.json(
      { success: false, error: 'Failed to mark notifications as read' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
