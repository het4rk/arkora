import { NextRequest, NextResponse } from 'next/server'
import { requireApiKey, CORS_HEADERS } from '@/lib/apiKeyAuth'
import { rateLimit } from '@/lib/rateLimit'
import { db } from '@/lib/db'
import { posts } from '@/lib/db/schema'
import { eq, and, or, lt, isNull, desc, sql } from 'drizzle-orm'
import { getNullifierByKeyHash } from '@/lib/db/apiKeys'
import { createPost } from '@/lib/db/posts'
import { sanitizeLine, sanitizeText, parseHashtags } from '@/lib/sanitize'
import { isVerifiedHuman, getUserByNullifier } from '@/lib/db/users'
import { ANONYMOUS_BOARDS } from '@/lib/types'
import { FEATURED_BOARDS, resolveBoard } from '@/lib/boards'
import { getPublicNullifier } from '@/lib/identityRules'
import { invalidatePosts } from '@/lib/cache'
import type { IdentityMode } from '@/lib/identityRules'

/**
 * GET /api/v1/posts
 * Returns verified-human posts. All data comes from World ID-verified accounts.
 *
 * Query params:
 *   boardId  - filter by board slug (e.g. "politics", "ai")
 *   type     - "text" | "poll" | "repost"
 *   limit    - 1-50 (default 20)
 *   cursor   - pagination cursor (ISO date string from previous response)
 *
 * Auth: X-API-Key header (or Authorization: Bearer <key>)
 *
 * Privacy: nullifierHash and walletAddress are never returned.
 *          Lat/lng are never returned. author.handle is the user's chosen display name or null.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(req: NextRequest) {
  const auth = await requireApiKey(req)
  if (auth instanceof NextResponse) return auth

  if (!rateLimit(`v1posts:${auth.key}`, 120, 60_000)) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429, headers: CORS_HEADERS }
    )
  }

  const { searchParams } = req.nextUrl
  const boardId = searchParams.get('boardId')
  const type = searchParams.get('type')
  const cursor = searchParams.get('cursor')
  const limitRaw = parseInt(searchParams.get('limit') ?? '20', 10)
  const limit = Math.min(Math.max(1, isNaN(limitRaw) ? 20 : limitRaw), 50)

  const conditions = [
    isNull(posts.deletedAt),
    sql`${posts.reportCount} < 5`,
  ]

  if (boardId) conditions.push(or(eq(posts.boardId, boardId), sql`${posts.tags} @> ARRAY[${boardId}]::text[]`)!)
  if (type && ['text', 'poll', 'repost'].includes(type)) {
    conditions.push(eq(posts.type, type as 'text' | 'poll' | 'repost'))
  }
  if (cursor) {
    const cursorDate = new Date(cursor)
    if (!isNaN(cursorDate.getTime())) conditions.push(lt(posts.createdAt, cursorDate))
  }

  try {
    const rows = await db
      .select({
        id: posts.id,
        title: posts.title,
        body: posts.body,
        boardId: posts.boardId,
        type: posts.type,
        imageUrl: posts.imageUrl,
        upvotes: posts.upvotes,
        downvotes: posts.downvotes,
        replyCount: posts.replyCount,
        quoteCount: posts.quoteCount,
        viewCount: posts.viewCount,
        createdAt: posts.createdAt,
        countryCode: posts.countryCode,
        tags: posts.tags,
        pollOptions: posts.pollOptions,
        pollEndsAt: posts.pollEndsAt,
        pseudoHandle: posts.pseudoHandle,
      })
      .from(posts)
      .where(and(...conditions))
      .orderBy(desc(posts.createdAt))
      .limit(limit + 1)

    const hasMore = rows.length > limit
    const items = rows.slice(0, limit).map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      boardId: r.boardId,
      type: r.type,
      imageUrl: r.imageUrl ?? null,
      upvotes: r.upvotes,
      downvotes: r.downvotes,
      replyCount: r.replyCount,
      quoteCount: r.quoteCount,
      viewCount: r.viewCount,
      createdAt: r.createdAt,
      countryCode: r.countryCode ?? null,
      tags: r.tags ?? [],
      pollOptions: r.type === 'poll' ? (r.pollOptions ?? null) : null,
      pollEndsAt: r.type === 'poll' ? (r.pollEndsAt?.toISOString() ?? null) : null,
      author: {
        handle: r.pseudoHandle ?? null,
        isVerified: true,
      },
    }))

    const nextCursor =
      hasMore && items.length > 0
        ? items[items.length - 1]!.createdAt.toISOString()
        : null

    return NextResponse.json(
      { success: true, data: items, nextCursor },
      { headers: CORS_HEADERS }
    )
  } catch (err) {
    console.error('[v1/posts GET]', err instanceof Error ? err.message : String(err))
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}

const FEATURED_IDS = FEATURED_BOARDS.map((b) => b.id)

/**
 * POST /api/v1/posts
 * Create a text post via API key. Simplified version of cookie-auth POST /api/posts.
 *
 * Body (JSON):
 *   title   - required, max 280 chars
 *   body    - optional, max 10,000 chars
 *   boardId - optional, defaults to "arkora"
 *
 * Auth: X-API-Key header (or Authorization: Bearer <key>)
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiKey(req)
  if (auth instanceof NextResponse) return auth

  if (!rateLimit(`v1post:${auth.key}`, 10, 60_000)) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429, headers: CORS_HEADERS }
    )
  }

  try {
    // Resolve the owner's nullifier from the key hash
    const nullifierHash = await getNullifierByKeyHash(auth.key)
    if (!nullifierHash) {
      return NextResponse.json(
        { success: false, error: 'API key owner not found' },
        { status: 403, headers: CORS_HEADERS }
      )
    }

    // Gate: must be a verified human
    const verified = await isVerifiedHuman(nullifierHash)
    if (!verified) {
      return NextResponse.json(
        { success: false, error: 'World ID verification required' },
        { status: 403, headers: CORS_HEADERS }
      )
    }

    const body = (await req.json()) as {
      title?: string
      body?: string
      boardId?: string
    }

    const rawTitle = body.title
    const rawBody = body.body
    const rawBoardId = body.boardId

    if (!rawTitle?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: title' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    const title = sanitizeLine(rawTitle)
    const postBody = sanitizeText(rawBody ?? '')

    if (title.length > 280) {
      return NextResponse.json(
        { success: false, error: 'Title exceeds 280 characters' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    if (postBody.length > 10000) {
      return NextResponse.json(
        { success: false, error: 'Body exceeds 10,000 characters' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    // Parse hashtags from title + body for multi-board discovery
    const tags = parseHashtags(`${title} ${postBody}`)

    // Resolve board
    let boardId = resolveBoard(rawBoardId ?? 'arkora', FEATURED_IDS)
    if (boardId === 'arkora' && tags.length > 0) {
      const autoBoard = resolveBoard(tags[0]!, FEATURED_IDS)
      if (autoBoard !== 'arkora') boardId = autoBoard
    }

    // Identity: always named mode unless anonymous board
    const user = await getUserByNullifier(nullifierHash)
    let identityMode: IdentityMode = (user?.identityMode as IdentityMode) ?? 'named'
    if (ANONYMOUS_BOARDS.has(boardId)) {
      identityMode = 'anonymous'
    }

    const pseudoHandle = identityMode === 'anonymous'
      ? undefined
      : user?.pseudoHandle ?? undefined

    const preAllocatedId = crypto.randomUUID()
    const publicNullifier = getPublicNullifier(nullifierHash, identityMode, preAllocatedId)

    const post = await createPost({
      id: preAllocatedId,
      title,
      body: postBody,
      boardId,
      nullifierHash: publicNullifier,
      pseudoHandle,
      type: 'text',
      authorNullifier: nullifierHash,
      postIdentityMode: identityMode,
      ...(tags.length > 0 && { tags }),
    })
    invalidatePosts()

    return NextResponse.json(
      {
        success: true,
        data: {
          id: post.id,
          title: post.title,
          boardId: post.boardId,
          createdAt: post.createdAt,
        },
      },
      { status: 201, headers: CORS_HEADERS }
    )
  } catch (err) {
    console.error('[v1/posts POST]', err instanceof Error ? err.message : String(err))
    return NextResponse.json(
      { success: false, error: 'Failed to create post' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
