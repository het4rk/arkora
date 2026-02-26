import { NextRequest, NextResponse } from 'next/server'
import { getPostsByNullifiers, getVotedPostsByNullifier } from '@/lib/db/posts'
import { getRepliesByNullifiers } from '@/lib/db/replies'
import { getUserByNullifier, getUserByWalletAddressNonWlt } from '@/lib/db/users'
import { getCallerNullifier, walletToNullifier } from '@/lib/serverAuth'
import { rateLimit } from '@/lib/rateLimit'

/**
 * Returns all nullifiers that belong to the same real-world user.
 * A user can have content under both their World ID nullifier and their
 * wlt_ wallet nullifier if they verified at different times.
 */
async function getLinkedNullifiers(nullifierHash: string): Promise<string[]> {
  const user = await getUserByNullifier(nullifierHash)
  if (!user?.walletAddress || user.walletAddress.startsWith('idkit_')) {
    return [nullifierHash]
  }

  const all = new Set([nullifierHash])

  if (nullifierHash.startsWith('wlt_')) {
    // Session is wallet-based — also check for linked World ID nullifier
    const wiUser = await getUserByWalletAddressNonWlt(user.walletAddress)
    if (wiUser) all.add(wiUser.nullifierHash)
  } else {
    // Session is World ID nullifier — also add linked wlt_ nullifier
    all.add(walletToNullifier(user.walletAddress))
  }

  return [...all]
}

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
      const nullifiers = await getLinkedNullifiers(nullifierHash)
      const items = await getPostsByNullifiers(nullifiers, cursor, limit)
      const hasMore = items.length === limit
      const nextCursor = hasMore ? items[items.length - 1]?.createdAt.toISOString() : undefined
      return NextResponse.json({ success: true, data: { items, hasMore, nextCursor } })
    }

    if (tab === 'replies') {
      const nullifiers = await getLinkedNullifiers(nullifierHash)
      const items = await getRepliesByNullifiers(nullifiers, limit)
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
