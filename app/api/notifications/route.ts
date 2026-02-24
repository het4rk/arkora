import { NextRequest, NextResponse } from 'next/server'
import { getNotifications, getUnreadCount, markAllRead } from '@/lib/db/notifications'
import { getCallerNullifier } from '@/lib/serverAuth'

// GET /api/notifications
// GET /api/notifications?countOnly=1
export async function GET(req: NextRequest) {
  try {
    const nullifierHash = await getCallerNullifier()
    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const countOnly = new URL(req.url).searchParams.get('countOnly') === '1'

    if (countOnly) {
      const count = await getUnreadCount(nullifierHash)
      return NextResponse.json({ success: true, data: { count } })
    }

    const items = await getNotifications(nullifierHash)
    return NextResponse.json({ success: true, data: items })
  } catch (err) {
    console.error('[notifications GET]', err)
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
    await markAllRead(nullifierHash)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[notifications POST]', err)
    return NextResponse.json({ success: false, error: 'Failed to mark read' }, { status: 500 })
  }
}
