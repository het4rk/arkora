import { NextRequest, NextResponse } from 'next/server'
import { toggleBookmark, getBookmarksByNullifier, isBookmarked, getBulkBookmarkStatus } from '@/lib/db/bookmarks'
import { isVerifiedHuman } from '@/lib/db/users'
import { getCallerNullifier } from '@/lib/serverAuth'
import { rateLimit } from '@/lib/rateLimit'

export async function GET(req: NextRequest) {
  try {
    const nullifierHash = await getCallerNullifier()
    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!rateLimit(`bookmarks:${nullifierHash}`, 30, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests. Slow down.' }, { status: 429 })
    }

    const { searchParams } = new URL(req.url)
    const postId = searchParams.get('postId')
    // ?postId= → single O(1) lookup
    if (postId) {
      const bookmarked = await isBookmarked(nullifierHash, postId)
      return NextResponse.json({ success: true, data: { isBookmarked: bookmarked } })
    }
    // ?postIds=id1,id2,… → bulk status check for feed (returns bookmarked subset)
    const postIdsParam = searchParams.get('postIds')
    if (postIdsParam) {
      const ids = postIdsParam.split(',').filter(Boolean).slice(0, 50)
      const bookmarkedIds = await getBulkBookmarkStatus(nullifierHash, ids)
      return NextResponse.json({ success: true, data: { bookmarkedIds } })
    }
    const posts = await getBookmarksByNullifier(nullifierHash)
    return NextResponse.json({ success: true, data: posts })
  } catch (err) {
    console.error('[bookmarks GET]', err)
    return NextResponse.json({ success: false, error: 'Failed to fetch bookmarks' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const nullifierHash = await getCallerNullifier()
    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const { postId } = (await req.json()) as { postId?: string }
    if (!postId) {
      return NextResponse.json({ success: false, error: 'postId required' }, { status: 400 })
    }
    if (!(await isVerifiedHuman(nullifierHash))) {
      return NextResponse.json({ success: false, error: 'Not verified' }, { status: 403 })
    }
    const isBookmarked = await toggleBookmark(nullifierHash, postId)
    return NextResponse.json({ success: true, data: { isBookmarked } })
  } catch (err) {
    console.error('[bookmarks POST]', err)
    return NextResponse.json({ success: false, error: 'Failed to toggle bookmark' }, { status: 500 })
  }
}
