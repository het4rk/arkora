import { NextRequest, NextResponse } from 'next/server'
import { toggleFollow, isFollowing, getFollowerCount, getFollowingCount } from '@/lib/db/follows'
import { isVerifiedHuman } from '@/lib/db/users'
import { createNotification } from '@/lib/db/notifications'
import { rateLimit } from '@/lib/rateLimit'
import { getCallerNullifier } from '@/lib/serverAuth'
import { worldAppNotify } from '@/lib/worldAppNotify'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const nullifierHash = searchParams.get('nullifierHash')

    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'nullifierHash required' }, { status: 400 })
    }

    const viewerHash = await getCallerNullifier()

    const [followerCount, followingCount, following] = await Promise.all([
      getFollowerCount(nullifierHash),
      getFollowingCount(nullifierHash),
      viewerHash ? isFollowing(viewerHash, nullifierHash) : Promise.resolve(false),
    ])

    return NextResponse.json({ success: true, data: { followerCount, followingCount, isFollowing: following } })
  } catch (err) {
    console.error('[follow GET]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Failed to fetch follow data' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const followerId = await getCallerNullifier()
    if (!followerId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const { followedId } = (await req.json()) as { followedId?: string }
    if (!followedId) {
      return NextResponse.json({ success: false, error: 'followedId required' }, { status: 400 })
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
      void worldAppNotify(followedId, 'New follower', 'Someone followed you on Arkora', '/notifications')
    }
    return NextResponse.json({ success: true, data: { isFollowing: isNowFollowing } })
  } catch (err) {
    console.error('[follow POST]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Failed to toggle follow' }, { status: 500 })
  }
}
