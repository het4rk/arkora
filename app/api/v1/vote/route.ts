import { NextRequest, NextResponse } from 'next/server'
import { requireApiKey, CORS_HEADERS } from '@/lib/apiKeyAuth'
import { rateLimit } from '@/lib/rateLimit'
import { getNullifierByKeyHash } from '@/lib/db/apiKeys'
import { isVerifiedHuman } from '@/lib/db/users'
import { getLinkedNullifiers } from '@/lib/serverAuth'
import {
  getPostNullifier,
  getVoteByNullifier,
  upsertVote,
  deletePostVote,
} from '@/lib/db/posts'
import { updateKarma } from '@/lib/db/karma'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  const auth = await requireApiKey(req)
  if (auth instanceof NextResponse) return auth

  if (!rateLimit(`v1vote:${auth.key}`, 60, 60_000)) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429, headers: CORS_HEADERS }
    )
  }

  try {
    const nullifierHash = await getNullifierByKeyHash(auth.key)
    if (!nullifierHash) {
      return NextResponse.json(
        { success: false, error: 'API key owner not found' },
        { status: 403, headers: CORS_HEADERS }
      )
    }

    const verified = await isVerifiedHuman(nullifierHash)
    if (!verified) {
      return NextResponse.json(
        { success: false, error: 'World ID verification required' },
        { status: 403, headers: CORS_HEADERS }
      )
    }

    const body = (await req.json()) as {
      postId?: string
      direction?: number
    }

    const { postId, direction } = body

    if (!postId?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: postId' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    if (direction !== 1 && direction !== -1 && direction !== 0) {
      return NextResponse.json(
        { success: false, error: 'direction must be 1, -1, or 0' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    // Prevent self-vote
    const linked = await getLinkedNullifiers(nullifierHash)
    const postOwner = await getPostNullifier(postId)
    if (postOwner && linked.includes(postOwner)) {
      return NextResponse.json(
        { success: false, error: 'Cannot vote on your own post' },
        { status: 403, headers: CORS_HEADERS }
      )
    }

    if (direction === 0) {
      await deletePostVote(postId, nullifierHash)
    } else {
      const existing = await getVoteByNullifier(postId, nullifierHash)
      await upsertVote(postId, nullifierHash, direction)

      // Fire-and-forget karma update
      if (postOwner) {
        const delta = existing
          ? direction - existing.direction
          : direction
        if (delta !== 0) {
          updateKarma(postOwner, delta).catch(() => {})
        }
      }
    }

    return NextResponse.json(
      { success: true, data: null },
      { headers: CORS_HEADERS }
    )
  } catch (err) {
    console.error('[v1/vote POST]', err instanceof Error ? err.message : String(err))
    return NextResponse.json(
      { success: false, error: 'Failed to process vote' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
