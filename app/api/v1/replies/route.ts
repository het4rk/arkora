import { NextRequest, NextResponse } from 'next/server'
import { requireApiKey, CORS_HEADERS } from '@/lib/apiKeyAuth'
import { rateLimit } from '@/lib/rateLimit'
import { getNullifierByKeyHash } from '@/lib/db/apiKeys'
import { isVerifiedHuman, getUserByNullifier } from '@/lib/db/users'
import { sanitizeText } from '@/lib/sanitize'
import { createReply } from '@/lib/db/replies'
import { getPublicNullifier } from '@/lib/identityRules'
import type { IdentityMode } from '@/lib/identityRules'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  const auth = await requireApiKey(req)
  if (auth instanceof NextResponse) return auth

  if (!(await rateLimit(`v1reply:${auth.key}`, 10, 60_000))) {
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
      body?: string
    }

    const { postId, body: rawBody } = body

    if (!postId?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: postId' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    if (!rawBody?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: body' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    const sanitizedBody = sanitizeText(rawBody)

    if (sanitizedBody.length > 10000) {
      return NextResponse.json(
        { success: false, error: 'Body exceeds 10,000 characters' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    const user = await getUserByNullifier(nullifierHash)
    const identityMode: IdentityMode = (user?.identityMode as IdentityMode) ?? 'named'
    const publicNullifier = getPublicNullifier(nullifierHash, identityMode, postId)

    const pseudoHandle = identityMode === 'anonymous'
      ? undefined
      : user?.pseudoHandle ?? undefined

    const reply = await createReply({
      postId,
      body: sanitizedBody,
      nullifierHash: publicNullifier,
      authorNullifier: nullifierHash,
      postIdentityMode: identityMode,
      pseudoHandle,
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          id: reply.id,
          body: reply.body,
          createdAt: reply.createdAt,
        },
      },
      { status: 201, headers: CORS_HEADERS }
    )
  } catch (err) {
    console.error('[v1/replies POST]', err instanceof Error ? err.message : String(err))
    return NextResponse.json(
      { success: false, error: 'Failed to create reply' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
