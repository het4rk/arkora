import { NextRequest, NextResponse } from 'next/server'
import { upsertVote, getPostNullifier } from '@/lib/db/posts'
import { isVerifiedHuman } from '@/lib/db/users'
import { rateLimit } from '@/lib/rateLimit'
import type { VoteInput } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as VoteInput
    const { postId, direction, nullifierHash } = body

    if (!postId || !nullifierHash || (direction !== 1 && direction !== -1)) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid fields' },
        { status: 400 }
      )
    }

    // Rate limit: 60 votes per minute
    if (!rateLimit(`vote:${nullifierHash}`, 60, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many votes. Slow down.' }, { status: 429 })
    }

    // Both checks are independent — run in parallel to save a round-trip
    const [verified, postOwner] = await Promise.all([
      isVerifiedHuman(nullifierHash),
      getPostNullifier(postId),
    ])

    if (!verified) {
      return NextResponse.json(
        { success: false, error: 'World ID verification required' },
        { status: 403 }
      )
    }
    if (!postOwner) {
      return NextResponse.json(
        { success: false, error: 'Post not found' },
        { status: 404 }
      )
    }

    if (postOwner === nullifierHash) {
      return NextResponse.json(
        { success: false, error: 'Cannot vote on your own post' },
        { status: 403 }
      )
    }

    await upsertVote(postId, nullifierHash, direction)
    // Client uses optimistic updates — no need to re-fetch the post
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[vote POST]', err)
    return NextResponse.json(
      { success: false, error: 'Failed to cast vote' },
      { status: 500 }
    )
  }
}
