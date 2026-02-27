import { NextRequest, NextResponse } from 'next/server'
import { createReply, getReplyPostId } from '@/lib/db/replies'
import { sanitizeLine, sanitizeText } from '@/lib/sanitize'
import { isVerifiedHuman } from '@/lib/db/users'
import { getPostNullifier } from '@/lib/db/posts'
import { createNotification } from '@/lib/db/notifications'
import { pusherServer } from '@/lib/pusher'
import { rateLimit } from '@/lib/rateLimit'
import { getCallerNullifier } from '@/lib/serverAuth'
import { worldAppNotify } from '@/lib/worldAppNotify'

export async function POST(req: NextRequest) {
  try {
    const nullifierHash = await getCallerNullifier()
    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { postId, body: rawBody, pseudoHandle: rawHandle, parentReplyId, imageUrl } = (await req.json()) as {
      postId?: string
      body?: string
      pseudoHandle?: string
      parentReplyId?: string
      imageUrl?: string
    }

    if (!postId || !rawBody?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const replyBody = sanitizeText(rawBody)
    const pseudoHandle = rawHandle ? sanitizeLine(rawHandle) : undefined

    if (replyBody.length > 10000) {
      return NextResponse.json(
        { success: false, error: 'Reply exceeds 10,000 characters' },
        { status: 400 }
      )
    }

    // Rate limit: 10 replies per minute
    if (!rateLimit(`reply:${nullifierHash}`, 10, 60_000)) {
      return NextResponse.json(
        { success: false, error: 'Too many replies. Try again in a minute.' },
        { status: 429 }
      )
    }

    const verified = await isVerifiedHuman(nullifierHash)
    if (!verified) {
      return NextResponse.json(
        { success: false, error: 'World ID verification required' },
        { status: 403 }
      )
    }

    // Validate parentReplyId belongs to the same post — prevents cross-post thread injection
    if (parentReplyId) {
      const parentPostId = await getReplyPostId(parentReplyId)
      if (!parentPostId || parentPostId !== postId) {
        return NextResponse.json({ success: false, error: 'Invalid parent reply' }, { status: 400 })
      }
    }

    const reply = await createReply({ postId, body: replyBody, nullifierHash, parentReplyId, pseudoHandle, imageUrl: imageUrl ?? undefined })

    // Notify post author + process @mentions — fire-and-forget
    void (async () => {
      try {
        const authorHash = await getPostNullifier(postId)
        if (authorHash && authorHash !== nullifierHash) {
          await createNotification(authorHash, 'reply', postId, pseudoHandle ? nullifierHash : undefined)
          void pusherServer.trigger(`user-${authorHash}`, 'notif-count', { delta: 1 })
          void worldAppNotify(authorHash, 'New reply', 'Someone replied to your post', `/posts/${postId}`)
        }

      } catch { /* non-critical */ }
    })()

    return NextResponse.json({ success: true, data: reply }, { status: 201 })
  } catch (err) {
    console.error('[replies POST]', err instanceof Error ? err.message : String(err))
    return NextResponse.json(
      { success: false, error: 'Failed to create reply' },
      { status: 500 }
    )
  }
}
