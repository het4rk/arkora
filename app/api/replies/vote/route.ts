import { NextRequest, NextResponse } from 'next/server'
import { upsertReplyVote, deleteReplyVote } from '@/lib/db/replies'
import { isVerifiedHuman } from '@/lib/db/users'
import { rateLimit } from '@/lib/rateLimit'
import { getCallerNullifier } from '@/lib/serverAuth'

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

    if (!replyId || (direction !== 1 && direction !== -1 && direction !== 0)) {
      return NextResponse.json({ success: false, error: 'Missing or invalid fields' }, { status: 400 })
    }
    if (!rateLimit(`reply-vote:${nullifierHash}`, 30, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many votes. Slow down.' }, { status: 429 })
    }
    if (!(await isVerifiedHuman(nullifierHash))) {
      return NextResponse.json({ success: false, error: 'Not verified' }, { status: 403 })
    }

    const counts = direction === 0
      ? await deleteReplyVote(replyId, nullifierHash)
      : await upsertReplyVote(replyId, nullifierHash, direction as 1 | -1)
    return NextResponse.json({ success: true, data: counts })
  } catch (err) {
    console.error('[replies/vote POST]', err)
    return NextResponse.json({ success: false, error: 'Failed to vote' }, { status: 500 })
  }
}
