import { NextRequest, NextResponse } from 'next/server'
import { upsertReplyVote } from '@/lib/db/replies'
import { isVerifiedHuman } from '@/lib/db/users'
import { rateLimit } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  try {
    const { replyId, nullifierHash, direction } = (await req.json()) as {
      replyId?: string
      nullifierHash?: string
      direction?: number
    }

    if (!replyId || !nullifierHash || (direction !== 1 && direction !== -1)) {
      return NextResponse.json({ success: false, error: 'Missing or invalid fields' }, { status: 400 })
    }
    if (!rateLimit(`reply-vote:${nullifierHash}`, 30, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many votes. Slow down.' }, { status: 429 })
    }
    if (!(await isVerifiedHuman(nullifierHash))) {
      return NextResponse.json({ success: false, error: 'Not verified' }, { status: 403 })
    }

    await upsertReplyVote(replyId, nullifierHash, direction as 1 | -1)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[replies/vote POST]', err)
    return NextResponse.json({ success: false, error: 'Failed to vote' }, { status: 500 })
  }
}
