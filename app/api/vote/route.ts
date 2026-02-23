import { NextRequest, NextResponse } from 'next/server'
import { upsertVote, getPostById } from '@/lib/db/posts'
import { isVerifiedHuman } from '@/lib/db/users'
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

    const verified = await isVerifiedHuman(nullifierHash)
    if (!verified) {
      return NextResponse.json(
        { success: false, error: 'World ID verification required' },
        { status: 403 }
      )
    }

    const post = await getPostById(postId)
    if (!post) {
      return NextResponse.json(
        { success: false, error: 'Post not found' },
        { status: 404 }
      )
    }

    await upsertVote(postId, nullifierHash, direction)

    const updated = await getPostById(postId)
    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    console.error('[vote POST]', err)
    return NextResponse.json(
      { success: false, error: 'Failed to cast vote' },
      { status: 500 }
    )
  }
}
