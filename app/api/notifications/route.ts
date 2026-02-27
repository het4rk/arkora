import { NextRequest, NextResponse } from 'next/server'
import { getNotifications, getUnreadCount, markAllRead } from '@/lib/db/notifications'
import { getUsersByNullifiers } from '@/lib/db/users'
import { getCallerNullifier } from '@/lib/serverAuth'
import { rateLimit } from '@/lib/rateLimit'
import type { EnrichedNotification } from '@/lib/types'

// GET /api/notifications — returns enriched notifications + unreadCount
export async function GET(req: NextRequest) {
  try {
    const nullifierHash = await getCallerNullifier()
    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!rateLimit(`notif-get:${nullifierHash}`, 30, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
    }

    // countOnly shortcut — just return the badge count without full enrichment
    const countOnly = new URL(req.url).searchParams.get('countOnly') === '1'
    if (countOnly) {
      const count = await getUnreadCount(nullifierHash)
      return NextResponse.json({ success: true, data: { count } })
    }

    const [notifs, unreadCount] = await Promise.all([
      getNotifications(nullifierHash, 30),
      getUnreadCount(nullifierHash),
    ])

    // Batch-fetch actor identities for identity-aware display names
    const actorHashes = [...new Set(notifs.map((n) => n.actorHash).filter(Boolean) as string[])]
    const usersMap = await getUsersByNullifiers(actorHashes)

    const enriched: EnrichedNotification[] = notifs.map((n) => {
      let actorDisplay: string | null = null
      if (n.actorHash) {
        const actor = usersMap.get(n.actorHash)
        if (actor && actor.identityMode !== 'anonymous' && actor.pseudoHandle) {
          actorDisplay = actor.pseudoHandle
        }
        // Anonymous actors → actorDisplay stays null → UI renders "Someone"
      }
      return { ...n, actorDisplay }
    })

    return NextResponse.json({ success: true, data: { notifications: enriched, unreadCount } })
  } catch (err) {
    console.error('[notifications GET]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Failed to fetch notifications' }, { status: 500 })
  }
}

// POST /api/notifications — mark all as read
export async function POST() {
  try {
    const nullifierHash = await getCallerNullifier()
    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    if (!rateLimit(`notif-mark:${nullifierHash}`, 20, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
    }
    await markAllRead(nullifierHash)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[notifications POST]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Failed to mark read' }, { status: 500 })
  }
}
