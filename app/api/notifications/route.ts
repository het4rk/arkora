import { NextRequest, NextResponse } from 'next/server'
import { getNotifications, getUnreadCount, markAllRead } from '@/lib/db/notifications'
import { isVerifiedHuman } from '@/lib/db/users'

// GET /api/notifications?nullifierHash=xxx
// GET /api/notifications?nullifierHash=xxx&countOnly=1
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const nullifierHash = searchParams.get('nullifierHash')
    const countOnly = searchParams.get('countOnly') === '1'

    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'nullifierHash required' }, { status: 400 })
    }
    if (!(await isVerifiedHuman(nullifierHash))) {
      return NextResponse.json({ success: false, error: 'Not verified' }, { status: 403 })
    }

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
export async function POST(req: NextRequest) {
  try {
    const { nullifierHash } = (await req.json()) as { nullifierHash?: string }
    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'nullifierHash required' }, { status: 400 })
    }
    if (!(await isVerifiedHuman(nullifierHash))) {
      return NextResponse.json({ success: false, error: 'Not verified' }, { status: 403 })
    }
    await markAllRead(nullifierHash)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[notifications POST]', err)
    return NextResponse.json({ success: false, error: 'Failed to mark read' }, { status: 500 })
  }
}
