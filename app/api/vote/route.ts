import { NextRequest, NextResponse } from 'next/server'
import { upsertVote, getPostNullifier, deletePostVote, getVoteByNullifier } from '@/lib/db/posts'
import { isVerifiedHuman } from '@/lib/db/users'
import { updateKarma } from '@/lib/db/karma'
import { createNotification } from '@/lib/db/notifications'
import { pusherServer } from '@/lib/pusher'
import { rateLimit } from '@/lib/rateLimit'
import { getCallerNullifier } from '@/lib/serverAuth'

export async function POST(req: NextRequest) {
  try {
    const nullifierHash = await getCallerNullifier()
    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { postId, direction } = (await req.json()) as { postId?: string; direction?: number }

    if (!postId || typeof direction !== 'number' || !Number.isInteger(direction) || (direction !== 1 && direction !== -1 && direction !== 0)) {
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

    // Fetch old vote before any mutation so we can compute the karma delta
    const oldVote = await getVoteByNullifier(postId, nullifierHash)
    const oldDir = oldVote?.direction ?? 0

    // direction=0 means un-vote - no self-vote check needed
    if (direction === 0) {
      await deletePostVote(postId, nullifierHash)
      // Karma delta: reverse the old vote effect
      if (oldDir !== 0) {
        const postOwner = await getPostNullifier(postId)
        if (postOwner) void updateKarma(postOwner, -oldDir).catch(() => {/* silent */})
      }
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

    // Karma delta: newDirection - oldDirection
    // e.g. new=+1, old=0 → +1; new=-1, old=+1 → -2; new=+1, old=-1 → +2
    const karmaDelta = direction - oldDir
    if (karmaDelta !== 0) {
      void updateKarma(postOwner, karmaDelta).catch(() => {/* silent */})
    }

    // Notify post owner on new upvote (not on un-vote, downvote, or re-vote same direction)
    if (direction === 1 && oldDir !== 1) {
      void (async () => {
        try {
          await createNotification(postOwner, 'like', postId, nullifierHash)
          void pusherServer.trigger(`private-user-${postOwner}`, 'notif-count', { delta: 1 })
        } catch { /* non-critical */ }
      })()
    }

    // Client uses optimistic updates - no need to re-fetch the post
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[vote POST]', err instanceof Error ? err.message : String(err))
    return NextResponse.json(
      { success: false, error: 'Failed to cast vote' },
      { status: 500 }
    )
  }
}
