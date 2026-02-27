import { NextRequest, NextResponse } from 'next/server'
import { getPostById } from '@/lib/db/posts'
import { castPollVote, getPollResults } from '@/lib/db/polls'
import { getCallerNullifier } from '@/lib/serverAuth'
import { rateLimit } from '@/lib/rateLimit'

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const nullifierHash = await getCallerNullifier()
    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!rateLimit(`poll-vote:${nullifierHash}`, 10, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests.' }, { status: 429 })
    }

    const { id } = await params
    const post = await getPostById(id)
    if (!post) {
      return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 })
    }
    if (post.type !== 'poll') {
      return NextResponse.json({ success: false, error: 'Not a poll' }, { status: 400 })
    }
    if (!post.pollOptions || post.pollOptions.length === 0) {
      return NextResponse.json({ success: false, error: 'Poll has no options' }, { status: 400 })
    }
    if (post.pollEndsAt && new Date(post.pollEndsAt) < new Date()) {
      return NextResponse.json({ success: false, error: 'Poll has ended' }, { status: 400 })
    }

    const body = (await req.json()) as { optionIndex?: number }
    const { optionIndex } = body
    if (
      typeof optionIndex !== 'number' ||
      !Number.isInteger(optionIndex) ||
      optionIndex < 0 ||
      optionIndex >= post.pollOptions.length
    ) {
      return NextResponse.json({ success: false, error: 'Invalid option' }, { status: 400 })
    }

    await castPollVote(id, nullifierHash, optionIndex)
    const results = await getPollResults(id)
    return NextResponse.json({ success: true, data: { results, userVote: optionIndex } })
  } catch (err) {
    console.error('[polls/[id]/vote POST]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Failed to record vote' }, { status: 500 })
  }
}
