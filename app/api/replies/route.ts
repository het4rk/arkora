import { NextRequest, NextResponse } from 'next/server'
import { createReply, getReplyPostId } from '@/lib/db/replies'
import { sanitizeLine, sanitizeText, parseMentions } from '@/lib/sanitize'
import { isVerifiedHuman, getUsersByHandles, getUserByNullifier } from '@/lib/db/users'
import { getPostAuthorNullifier } from '@/lib/db/posts'
import { createNotification } from '@/lib/db/notifications'
import { pusherServer } from '@/lib/pusher'
import { rateLimit } from '@/lib/rateLimit'
import { getCallerNullifier } from '@/lib/serverAuth'
import { worldAppNotify } from '@/lib/worldAppNotify'
import { isAllowedImageDomain } from '@/lib/storage/hippius'
import { getPublicNullifier } from '@/lib/identityRules'
import type { IdentityMode } from '@/lib/identityRules'

export async function POST(req: NextRequest) {
  try {
    const nullifierHash = await getCallerNullifier()
    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { postId, body: rawBody, pseudoHandle: rawHandle, parentReplyId, imageUrl, identityMode: requestedMode } = (await req.json()) as {
      postId?: string
      body?: string
      pseudoHandle?: string
      parentReplyId?: string
      imageUrl?: string
      identityMode?: string
    }

    if (!postId || !rawBody?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const replyBody = sanitizeText(rawBody)

    // Resolve identity mode: prefer per-action choice from request body, fall back to DB profile
    const validModes: IdentityMode[] = ['anonymous', 'alias', 'named']
    const user = await getUserByNullifier(nullifierHash)
    const identityMode: IdentityMode = (validModes.includes(requestedMode as IdentityMode)
      ? (requestedMode as IdentityMode)
      : null) ?? (user?.identityMode as IdentityMode) ?? 'anonymous'

    const pseudoHandle = identityMode === 'anonymous'
      ? undefined
      : rawHandle ? sanitizeLine(rawHandle).slice(0, 50) : undefined

    if (replyBody.length > 10000) {
      return NextResponse.json(
        { success: false, error: 'Reply exceeds 10,000 characters' },
        { status: 400 }
      )
    }

    // Rate limit: 10 replies per minute
    if (!(await rateLimit(`reply:${nullifierHash}`, 10, 60_000))) {
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

    // Validate imageUrl if provided - reject non-http(s) schemes and non-whitelisted domains
    if (imageUrl !== undefined && imageUrl !== null) {
      try {
        const parsed = new URL(String(imageUrl))
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error()
        if (String(imageUrl).length > 2048) throw new Error()
      } catch {
        return NextResponse.json({ success: false, error: 'Invalid image URL' }, { status: 400 })
      }
      if (!isAllowedImageDomain(String(imageUrl))) {
        return NextResponse.json({ success: false, error: 'Image URL must be hosted on an approved domain' }, { status: 400 })
      }
    }

    // Validate parentReplyId belongs to the same post - prevents cross-post thread injection
    if (parentReplyId) {
      const parentPostId = await getReplyPostId(parentReplyId)
      if (!parentPostId || parentPostId !== postId) {
        return NextResponse.json({ success: false, error: 'Invalid parent reply' }, { status: 400 })
      }
    }

    // Derive public-facing nullifier based on identity mode
    // For replies, anon mode uses the parent postId as the seed (so all anon replies in the same thread share a session identity)
    const publicNullifier = getPublicNullifier(nullifierHash, identityMode, postId)

    const reply = await createReply({
      postId,
      body: replyBody,
      nullifierHash: publicNullifier,
      parentReplyId,
      pseudoHandle,
      imageUrl: imageUrl ?? undefined,
      authorNullifier: nullifierHash,
      postIdentityMode: identityMode,
    })

    // Notify post author + process @mentions - fire-and-forget
    void (async () => {
      try {
        // Only reveal actor identity for named-mode replies
        const notifActor = identityMode === 'named' ? nullifierHash : undefined
        const authorHash = await getPostAuthorNullifier(postId)
        if (authorHash && authorHash !== nullifierHash) {
          await createNotification(authorHash, 'reply', postId, notifActor)
          void pusherServer.trigger(`private-user-${authorHash}`, 'notif-count', { delta: 1 })
          void worldAppNotify(authorHash, 'New reply', 'Someone replied to your post', `/posts/${postId}`)
        }

        // @mention notifications
        const handles = parseMentions(replyBody)
        if (handles.length > 0) {
          const mentioned = await getUsersByHandles(handles)
          await Promise.all(
            mentioned
              .filter((u) => u.nullifierHash !== nullifierHash && u.nullifierHash !== authorHash)
              .map(async (u) => {
                await createNotification(u.nullifierHash, 'mention', postId, notifActor)
                void pusherServer.trigger(`private-user-${u.nullifierHash}`, 'notif-count', { delta: 1 })
                void worldAppNotify(u.nullifierHash, 'You were mentioned', 'Someone mentioned you in a reply', `/posts/${postId}`)
              })
          )
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
