import { NextRequest, NextResponse } from 'next/server'
import { toggleBookmark, getBookmarksByNullifier, isBookmarked } from '@/lib/db/bookmarks'
import { isVerifiedHuman } from '@/lib/db/users'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const nullifierHash = searchParams.get('nullifierHash')
    const postId = searchParams.get('postId')
    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'nullifierHash required' }, { status: 400 })
    }
    // ?postId= → single O(1) lookup instead of fetching the whole list
    if (postId) {
      const bookmarked = await isBookmarked(nullifierHash, postId)
      return NextResponse.json({ success: true, data: { isBookmarked: bookmarked } })
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
    const { nullifierHash, postId } = (await req.json()) as { nullifierHash?: string; postId?: string }
    if (!nullifierHash || !postId) {
      return NextResponse.json({ success: false, error: 'nullifierHash and postId required' }, { status: 400 })
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
