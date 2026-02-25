import { NextRequest, NextResponse } from 'next/server'
import { createPost } from '@/lib/db/posts'
import { sanitizeLine, sanitizeText, parseMentions } from '@/lib/sanitize'
import { getFeedFollowing } from '@/lib/db/follows'
import { isVerifiedHuman, getUsersByHandles } from '@/lib/db/users'
import { rateLimit } from '@/lib/rateLimit'
import { getCallerNullifier } from '@/lib/serverAuth'
import { getCachedFeed, getCachedLocalFeed, getCachedHotFeed, invalidatePosts } from '@/lib/cache'
import { createNotification } from '@/lib/db/notifications'
import { pusherServer } from '@/lib/pusher'
import { worldAppNotify } from '@/lib/worldAppNotify'
import { BOARDS } from '@/lib/types'
import type { BoardId, CreatePostInput, FeedParams, LocalFeedParams } from '@/lib/types'

/** Extract the viewer's country code from standard edge/CDN headers. Falls back to 'US' in dev. */
function getCountryCode(req: NextRequest): string | null {
  return (
    req.headers.get('x-vercel-ip-country') ??
    req.headers.get('cf-ipcountry') ??
    req.headers.get('x-country-code') ??
    (process.env.NODE_ENV === 'development' ? 'US' : null)
  )
}

const VALID_BOARD_IDS = new Set(BOARDS.map((b) => b.id))

export async function GET(req: NextRequest) {
  try {
    // Rate limit: 60 requests/min per IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'unknown'
    if (!rateLimit(`feed:${ip}`, 60, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests.' }, { status: 429 })
    }

    const { searchParams } = new URL(req.url)
    const feed = searchParams.get('feed')
    const cursor = searchParams.get('cursor') ?? undefined
    const limit = parseInt(searchParams.get('limit') ?? '10', 10)

    // Following feed — caller identity from cookie
    if (feed === 'following') {
      const callerHash = await getCallerNullifier()
      if (!callerHash) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      }
      const posts = await getFeedFollowing(callerHash, cursor, limit)
      return NextResponse.json({ success: true, data: posts })
    }

    // Hot feed — Wilson-score time-decay ranking, no cursor pagination
    if (feed === 'hot') {
      const rawBoardId = searchParams.get('boardId')
      const hotBoardId = rawBoardId && VALID_BOARD_IDS.has(rawBoardId as BoardId) ? rawBoardId : undefined
      const hotPosts = await getCachedHotFeed(hotBoardId)
      return NextResponse.json({ success: true, data: hotPosts })
    }

    // Local feed — country-scoped, optionally radius-filtered
    if (feed === 'local') {
      const countryCode = getCountryCode(req)
      if (!countryCode) {
        return NextResponse.json({ success: true, data: [] })
      }
      const rawBoardId = searchParams.get('boardId')
      const lat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : undefined
      const lng = searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : undefined
      const radiusMiles = searchParams.get('radiusMiles') ? parseFloat(searchParams.get('radiusMiles')!) : undefined
      const localParams: LocalFeedParams = {
        countryCode,
        lat: lat !== undefined && !isNaN(lat) ? lat : undefined,
        lng: lng !== undefined && !isNaN(lng) ? lng : undefined,
        radiusMiles,
        boardId: rawBoardId && VALID_BOARD_IDS.has(rawBoardId as BoardId) ? (rawBoardId as BoardId) : undefined,
        cursor,
        limit,
      }
      const localPosts = await getCachedLocalFeed(localParams)
      return NextResponse.json({ success: true, data: localPosts })
    }

    const rawBoardId = searchParams.get('boardId')
    const params: FeedParams = {
      boardId: rawBoardId && VALID_BOARD_IDS.has(rawBoardId as BoardId) ? (rawBoardId as BoardId) : undefined,
      cursor,
      limit,
    }

    const posts = await getCachedFeed(params)
    return NextResponse.json({ success: true, data: posts })
  } catch (err) {
    console.error('[posts GET]', err)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch posts' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const nullifierHash = await getCallerNullifier()
    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json()) as {
      title?: string; body?: string; boardId?: string
      pseudoHandle?: string; imageUrl?: string; quotedPostId?: string
      lat?: number; lng?: number
      type?: string; pollOptions?: string[]; pollDuration?: number
    }

    const { title: rawTitle, body: rawBody, boardId: rawBoardId, pseudoHandle: rawHandle } = body

    const isPoll = body.type === 'poll'

    if (!rawTitle?.trim() || !rawBoardId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // For regular posts body is required; polls use title as the question
    if (!isPoll && !rawBody?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Poll-specific validation
    if (isPoll) {
      const opts = body.pollOptions
      if (!Array.isArray(opts) || opts.length < 2 || opts.length > 4) {
        return NextResponse.json({ success: false, error: 'Polls require 2–4 options' }, { status: 400 })
      }
      for (const opt of opts) {
        if (typeof opt !== 'string' || !opt.trim() || opt.trim().length > 100) {
          return NextResponse.json({ success: false, error: 'Each option must be 1–100 characters' }, { status: 400 })
        }
      }
      const duration = body.pollDuration
      if (duration !== undefined && ![24, 72, 168].includes(duration)) {
        return NextResponse.json({ success: false, error: 'Invalid poll duration' }, { status: 400 })
      }
    }

    const title = sanitizeLine(rawTitle)
    const postBody = isPoll ? '' : sanitizeText(rawBody ?? '')
    const pseudoHandle = rawHandle ? sanitizeLine(rawHandle) : undefined

    const boardId = rawBoardId as BoardId
    if (!VALID_BOARD_IDS.has(boardId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid board' },
        { status: 400 }
      )
    }

    if (title.length > 280) {
      return NextResponse.json(
        { success: false, error: 'Title exceeds 280 characters' },
        { status: 400 }
      )
    }

    if (!isPoll && postBody.length > 10000) {
      return NextResponse.json(
        { success: false, error: 'Body exceeds 10,000 characters' },
        { status: 400 }
      )
    }

    // Rate limit: 5 posts per minute per user
    if (!rateLimit(`post:${nullifierHash}`, 5, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many posts. Try again in a minute.' }, { status: 429 })
    }

    // Gate: must be a verified human
    const verified = await isVerifiedHuman(nullifierHash)
    if (!verified) {
      return NextResponse.json(
        { success: false, error: 'World ID verification required' },
        { status: 403 }
      )
    }

    const quotedPostId = typeof body.quotedPostId === 'string' ? body.quotedPostId : undefined

    // Validate imageUrl if provided — reject non-http(s) schemes (e.g. javascript:)
    const rawImageUrl = body.imageUrl
    if (rawImageUrl !== undefined && rawImageUrl !== null) {
      try {
        const parsed = new URL(String(rawImageUrl))
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error()
      } catch {
        return NextResponse.json({ success: false, error: 'Invalid image URL' }, { status: 400 })
      }
    }

    // Country inferred from poster's IP — used for local feed filtering
    const countryCode = getCountryCode(req) ?? undefined
    // GPS coords — only present when poster has location sharing enabled
    const lat = typeof body.lat === 'number' && isFinite(body.lat) ? body.lat : undefined
    const lng = typeof body.lng === 'number' && isFinite(body.lng) ? body.lng : undefined

    // Build poll-specific fields
    let pollOptions: { index: number; text: string }[] | undefined
    let pollEndsAt: Date | undefined
    if (isPoll && Array.isArray(body.pollOptions)) {
      pollOptions = body.pollOptions.map((opt, i) => ({ index: i, text: sanitizeLine(opt) }))
      const durationHours = body.pollDuration ?? 72
      pollEndsAt = new Date(Date.now() + durationHours * 60 * 60 * 1000)
    }

    const post = await createPost({
      title, body: postBody, boardId, nullifierHash, pseudoHandle,
      imageUrl: rawImageUrl, quotedPostId, lat, lng, countryCode,
      type: isPoll ? 'poll' : 'text',
      ...(pollOptions !== undefined && { pollOptions }),
      ...(pollEndsAt !== undefined && { pollEndsAt }),
    })
    invalidatePosts()

    // Process @mentions — fire-and-forget, does not block response
    void (async () => {
      try {
        const handles = parseMentions(postBody)
        if (handles.length === 0) return
        const handleMap = await getUsersByHandles(handles)
        for (const [, mentionedHash] of handleMap) {
          if (mentionedHash === nullifierHash) continue // don't notify self
          await createNotification(mentionedHash, 'mention', post.id, nullifierHash)
          void pusherServer.trigger(`user-${mentionedHash}`, 'notif-count', { delta: 1 })
          void worldAppNotify(mentionedHash, 'You were mentioned', 'Someone mentioned you in a post', `/posts/${post.id}`)
        }
      } catch { /* non-critical */ }
    })()

    return NextResponse.json({ success: true, data: post }, { status: 201 })
  } catch (err) {
    console.error('[posts POST]', err)
    return NextResponse.json(
      { success: false, error: 'Failed to create post' },
      { status: 500 }
    )
  }
}
