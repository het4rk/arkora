import { NextRequest, NextResponse } from 'next/server'
import { upsertVote, getPostNullifier, deletePostVote } from '@/lib/db/posts'
import { isVerifiedHuman } from '@/lib/db/users'
import { rateLimit } from '@/lib/rateLimit'
import { getCallerNullifier } from '@/lib/serverAuth'

export async function POST(req: NextRequest) {
  try {
    const nullifierHash = await getCallerNullifier()
    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { postId, direction } = (await req.json()) as { postId?: string; direction?: number }

    if (!postId || (direction !== 1 && direction !== -1 && direction !== 0)) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid fields' },
        { status: 400 }
      )
    }

    // Rate limit: 60 votes per minute
    if (!rateLimit(`vote:${nullifierHash}`, 60, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many votes. Slow down.' }, { status: 429 })
    }

    if (!(await isVerifiedHuman(nullifierHash))) {
      return NextResponse.json(
        { success: false, error: 'World ID verification required' },
        { status: 403 }
      )
    }

    // direction=0 means un-vote — no self-vote check needed
    if (direction === 0) {
      await deletePostVote(postId, nullifierHash)
      return NextResponse.json({ success: true })
    }

    const postOwner = await getPostNullifier(postId)
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
