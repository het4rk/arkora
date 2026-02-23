import { NextRequest, NextResponse } from 'next/server'
import { createReply } from '@/lib/db/replies'
import { isVerifiedHuman } from '@/lib/db/users'
import type { CreateReplyInput } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateReplyInput

    const { postId, body: replyBody, nullifierHash, parentReplyId, pseudoHandle } = body

    if (!postId || !replyBody?.trim() || !nullifierHash) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (replyBody.length > 10000) {
      return NextResponse.json(
        { success: false, error: 'Reply exceeds 10,000 characters' },
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

    const reply = await createReply({ postId, body: replyBody, nullifierHash, parentReplyId, pseudoHandle })
    return NextResponse.json({ success: true, data: reply }, { status: 201 })
  } catch (err) {
    console.error('[replies POST]', err)
    return NextResponse.json(
      { success: false, error: 'Failed to create reply' },
      { status: 500 }
    )
  }
}
