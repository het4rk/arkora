import { NextRequest, NextResponse } from 'next/server'
import { getPostsByNullifier, getVotedPostsByNullifier } from '@/lib/db/posts'
import { getRepliesByNullifier } from '@/lib/db/replies'
import { getCallerNullifier } from '@/lib/serverAuth'
import { rateLimit } from '@/lib/rateLimit'

export async function GET(req: NextRequest) {
  try {
    const nullifierHash = await getCallerNullifier()
    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!rateLimit(`profile:${nullifierHash}`, 60, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests. Slow down.' }, { status: 429 })
    }

    const { searchParams } = new URL(req.url)
    const tab = searchParams.get('tab') ?? 'posts'
    const cursor = searchParams.get('cursor') ?? undefined
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 50)

    if (tab === 'posts') {
      const items = await getPostsByNullifier(nullifierHash, cursor, limit)
      const hasMore = items.length === limit
      const nextCursor = hasMore ? items[items.length - 1]?.createdAt.toISOString() : undefined
      return NextResponse.json({ success: true, data: { items, hasMore, nextCursor } })
    }

    if (tab === 'replies') {
      const items = await getRepliesByNullifier(nullifierHash, limit)
      return NextResponse.json({ success: true, data: { items, hasMore: false } })
    }

    if (tab === 'votes') {
      const items = await getVotedPostsByNullifier(nullifierHash, limit)
      return NextResponse.json({ success: true, data: { items, hasMore: false } })
    }

    return NextResponse.json({ success: false, error: 'Invalid tab' }, { status: 400 })
  } catch (err) {
    console.error('[profile GET]', err)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch profile data' },
      { status: 500 }
    )
  }
}
