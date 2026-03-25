import { NextRequest, NextResponse } from 'next/server'
import { upsertReplyVote, deleteReplyVote, getReplyNullifier, getReplyVoteByNullifier, hasAnyReplyVote } from '@/lib/db/replies'
import { isVerifiedHuman } from '@/lib/db/users'
import { updateKarma } from '@/lib/db/karma'
import { rateLimit } from '@/lib/rateLimit'
import { getCallerNullifier, getLinkedNullifiers } from '@/lib/serverAuth'

export async function POST(req: NextRequest) {
  try {
    const nullifierHash = await getCallerNullifier()
    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { replyId, direction } = (await req.json()) as {
      replyId?: string
      direction?: number
    }

    if (!replyId || typeof direction !== 'number' || !Number.isInteger(direction) || (direction !== 1 && direction !== -1 && direction !== 0)) {
      return NextResponse.json({ success: false, error: 'Missing or invalid fields' }, { status: 400 })
    }
    if (!(await rateLimit(`reply-vote:${nullifierHash}`, 30, 60_000))) {
      return NextResponse.json({ success: false, error: 'Too many votes. Slow down.' }, { status: 429 })
    }
    if (!(await isVerifiedHuman(nullifierHash))) {
      return NextResponse.json({ success: false, error: 'Not verified' }, { status: 403 })
    }

    // Fetch old vote before mutation to compute karma delta
    const oldVote = await getReplyVoteByNullifier(replyId, nullifierHash)
    const oldDir = oldVote?.direction ?? 0

    // direction=0 means un-vote - no self-vote check needed
    if (direction === 0) {
      const counts = await deleteReplyVote(replyId, nullifierHash)
      if (oldDir !== 0) {
        const replyOwner = await getReplyNullifier(replyId)
        if (replyOwner) void updateKarma(replyOwner, -oldDir).catch(() => {/* silent */})
      }
      return NextResponse.json({ success: true, data: counts })
    }

    const replyOwner = await getReplyNullifier(replyId)
    if (!replyOwner) {
      return NextResponse.json({ success: false, error: 'Reply not found' }, { status: 404 })
    }

    // Resolve all linked identities (World ID 0x + wallet wlt_) for this user
    const allLinked = await getLinkedNullifiers(nullifierHash)

    // Self-vote check: block if any linked identity owns the reply
    if (allLinked.includes(replyOwner)) {
      return NextResponse.json({ success: false, error: 'Cannot vote on your own reply' }, { status: 403 })
    }

    // Double-vote check: batch query all linked identities at once
    if (oldDir === 0) {
      const otherLinked = allLinked.filter((l) => l !== nullifierHash)
      if (otherLinked.length > 0 && await hasAnyReplyVote(replyId, otherLinked)) {
        return NextResponse.json({ success: false, error: 'You have already voted on this reply' }, { status: 403 })
      }
    }

    const counts = await upsertReplyVote(replyId, nullifierHash, direction as 1 | -1)

    const karmaDelta = direction - oldDir
    if (karmaDelta !== 0) {
      void updateKarma(replyOwner, karmaDelta).catch(() => {/* silent */})
    }

    return NextResponse.json({ success: true, data: counts })
  } catch (err) {
    console.error('[replies/vote POST]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Failed to vote' }, { status: 500 })
  }
}
