import { NextRequest, NextResponse } from 'next/server'
import { getUserByNullifier } from '@/lib/db/users'
import { getPostsByNullifier } from '@/lib/db/posts'
import { getPublicProfileData, isFollowing } from '@/lib/db/follows'
import { getSubscriberCount, getActiveSubscription } from '@/lib/db/subscriptions'
import { getCallerNullifier } from '@/lib/serverAuth'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id: nullifierHash } = await params
    const viewerHash = await getCallerNullifier()

    const [user, posts, profileStats, following, subscriberCount, activeSub] = await Promise.all([
      getUserByNullifier(nullifierHash),
      getPostsByNullifier(nullifierHash, undefined, 30),
      getPublicProfileData(nullifierHash),
      viewerHash ? isFollowing(viewerHash, nullifierHash) : Promise.resolve(false),
      getSubscriberCount(nullifierHash),
      viewerHash ? getActiveSubscription(viewerHash, nullifierHash) : Promise.resolve(null),
    ])

    const daysLeft = activeSub
      ? Math.max(0, Math.ceil((activeSub.expiresAt.getTime() - Date.now()) / 86_400_000))
      : null

    return NextResponse.json({
      success: true,
      data: {
        user,
        posts,
        ...profileStats,
        isFollowing: following,
        subscriberCount,
        isSubscribed: !!activeSub,
        subscriptionDaysLeft: daysLeft,
      },
    })
  } catch (err) {
    console.error('[u/[id] GET]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Failed to fetch profile' }, { status: 500 })
  }
}
