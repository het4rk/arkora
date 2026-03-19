import { NextRequest, NextResponse } from 'next/server'
import { getUserByNullifier } from '@/lib/db/users'
import { getPostsByNullifier } from '@/lib/db/posts'
import { getPublicProfileData, isFollowing } from '@/lib/db/follows'
import { getSubscriberCount, getActiveSubscription } from '@/lib/db/subscriptions'
import { getTipTotalReceived } from '@/lib/db/tips'
import { getCallerNullifier } from '@/lib/serverAuth'
import { rateLimit } from '@/lib/rateLimit'
import { hasProfile } from '@/lib/identityRules'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id: nullifierHash } = await params

    const ip = req.headers.get('x-forwarded-for') ?? 'anon'
    if (!rateLimit(`profile:${ip}`, 60, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
    }

    const viewerHash = await getCallerNullifier()

    const user = await getUserByNullifier(nullifierHash)

    // Profile is only available for named-mode users
    if (!user || !hasProfile((user.identityMode as 'anonymous' | 'alias' | 'named') ?? 'anonymous')) {
      return NextResponse.json({
        success: true,
        data: { user: null, profileAvailable: false },
      })
    }

    const [posts, profileStats, following, subscriberCount, activeSub, tipTotal] = await Promise.all([
      getPostsByNullifier(nullifierHash, undefined, 30),
      getPublicProfileData(nullifierHash),
      viewerHash ? isFollowing(viewerHash, nullifierHash) : Promise.resolve(false),
      getSubscriberCount(nullifierHash),
      viewerHash ? getActiveSubscription(viewerHash, nullifierHash) : Promise.resolve(null),
      getTipTotalReceived(nullifierHash),
    ])

    const daysLeft = activeSub
      ? Math.max(0, Math.ceil((activeSub.expiresAt.getTime() - Date.now()) / 86_400_000))
      : null

    // Strip walletAddress from public profile - only expose public-facing fields
    const safeUser = user ? {
      nullifierHash: user.nullifierHash,
      pseudoHandle: user.pseudoHandle,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      identityMode: user.identityMode,
      karmaScore: user.karmaScore,
      worldIdVerified: user.worldIdVerified,
      verifiedBlockNumber: user.verifiedBlockNumber,
      registrationTxHash: user.registrationTxHash,
      createdAt: user.createdAt,
    } : null

    // Only show named-mode posts on the public profile
    const namedPosts = posts.filter((p) => p.postIdentityMode === 'named')

    return NextResponse.json({
      success: true,
      data: {
        user: safeUser,
        posts: namedPosts,
        profileAvailable: true,
        ...profileStats,
        isFollowing: following,
        subscriberCount,
        isSubscribed: !!activeSub,
        subscriptionDaysLeft: daysLeft,
        tipTotalReceived: tipTotal,
      },
    })
  } catch (err) {
    console.error('[u/[id] GET]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Failed to fetch profile' }, { status: 500 })
  }
}
