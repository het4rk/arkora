import { NextRequest, NextResponse } from 'next/server'
import { toggleFollow, isFollowing, getFollowerCount, getFollowingCount } from '@/lib/db/follows'
import { isVerifiedHuman, getUserByNullifier } from '@/lib/db/users'
import { createNotification } from '@/lib/db/notifications'
import { rateLimit } from '@/lib/rateLimit'
import { getCallerNullifier, getLinkedNullifiers } from '@/lib/serverAuth'
import { worldAppNotify } from '@/lib/worldAppNotify'
import { canFollow } from '@/lib/identityRules'

export async function GET(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    if (!(await rateLimit(`follow-get:${ip}`, 60, 60_000))) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
    }

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
    const allLinked = await getLinkedNullifiers(followerId)
    if (allLinked.includes(followedId)) {
      return NextResponse.json({ success: false, error: 'Cannot follow yourself' }, { status: 400 })
    }
    if (!(await rateLimit(`follow:${followerId}`, 30, 60_000))) {
      return NextResponse.json({ success: false, error: 'Too many actions. Slow down.' }, { status: 429 })
    }
    if (!(await isVerifiedHuman(followerId))) {
      return NextResponse.json({ success: false, error: 'Not verified' }, { status: 403 })
    }

    // Both follower and followed must be in named mode
    const [followerUser, followedUser] = await Promise.all([
      getUserByNullifier(followerId),
      getUserByNullifier(followedId),
    ])
    const followerMode = (followerUser?.identityMode ?? 'anonymous') as 'anonymous' | 'alias' | 'named'
    const followedMode = (followedUser?.identityMode ?? 'anonymous') as 'anonymous' | 'alias' | 'named'
    if (!canFollow(followerMode, followedMode)) {
      return NextResponse.json({ success: false, error: 'Follow is only available between named users' }, { status: 403 })
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
