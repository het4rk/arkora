import { NextRequest, NextResponse } from 'next/server'
import { toggleFollow, isFollowing, getFollowerCount, getFollowingCount } from '@/lib/db/follows'
import { isVerifiedHuman } from '@/lib/db/users'
import { createNotification } from '@/lib/db/notifications'
import { rateLimit } from '@/lib/rateLimit'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const nullifierHash = searchParams.get('nullifierHash')
    const viewerHash = searchParams.get('viewerHash')

    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'nullifierHash required' }, { status: 400 })
    }

    const [followerCount, followingCount, following] = await Promise.all([
      getFollowerCount(nullifierHash),
      getFollowingCount(nullifierHash),
      viewerHash ? isFollowing(viewerHash, nullifierHash) : Promise.resolve(false),
    ])

    return NextResponse.json({ success: true, data: { followerCount, followingCount, isFollowing: following } })
  } catch (err) {
    console.error('[follow GET]', err)
    return NextResponse.json({ success: false, error: 'Failed to fetch follow data' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { followerId, followedId } = (await req.json()) as { followerId?: string; followedId?: string }
    if (!followerId || !followedId) {
      return NextResponse.json({ success: false, error: 'followerId and followedId required' }, { status: 400 })
    }
    if (followerId === followedId) {
      return NextResponse.json({ success: false, error: 'Cannot follow yourself' }, { status: 400 })
    }
    if (!rateLimit(`follow:${followerId}`, 30, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many actions. Slow down.' }, { status: 429 })
    }
    if (!(await isVerifiedHuman(followerId))) {
      return NextResponse.json({ success: false, error: 'Not verified' }, { status: 403 })
    }
    const isNowFollowing = await toggleFollow(followerId, followedId)
    // Notify when following (not unfollowing)
    if (isNowFollowing) {
      void createNotification(followedId, 'follow', undefined, followerId)
    }
    return NextResponse.json({ success: true, data: { isFollowing: isNowFollowing } })
  } catch (err) {
    console.error('[follow POST]', err)
    return NextResponse.json({ success: false, error: 'Failed to toggle follow' }, { status: 500 })
  }
}
