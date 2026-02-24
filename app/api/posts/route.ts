import { NextRequest, NextResponse } from 'next/server'
import { getFeed, createPost } from '@/lib/db/posts'
import { getFeedFollowing } from '@/lib/db/follows'
import { isVerifiedHuman } from '@/lib/db/users'
import { rateLimit } from '@/lib/rateLimit'
import { BOARDS } from '@/lib/types'
import type { BoardId, CreatePostInput, FeedParams } from '@/lib/types'

const VALID_BOARD_IDS = new Set(BOARDS.map((b) => b.id))

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const feed = searchParams.get('feed')
    const nullifierHash = searchParams.get('nullifierHash')
    const cursor = searchParams.get('cursor') ?? undefined
    const limit = parseInt(searchParams.get('limit') ?? '10', 10)

    // Following feed
    if (feed === 'following' && nullifierHash) {
      const posts = await getFeedFollowing(nullifierHash, cursor, limit)
      return NextResponse.json({ success: true, data: posts })
    }

    const rawBoardId = searchParams.get('boardId')
    const params: FeedParams = {
      boardId: rawBoardId && VALID_BOARD_IDS.has(rawBoardId as BoardId) ? (rawBoardId as BoardId) : undefined,
      cursor,
      limit,
    }

    const posts = await getFeed(params)
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
    const body = (await req.json()) as CreatePostInput

    const { title, body: postBody, boardId, nullifierHash, pseudoHandle } = body

    if (!title?.trim() || !postBody?.trim() || !boardId || !nullifierHash) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

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

    if (postBody.length > 10000) {
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

    const post = await createPost({ title, body: postBody, boardId, nullifierHash, pseudoHandle, imageUrl: rawImageUrl, quotedPostId })
    return NextResponse.json({ success: true, data: post }, { status: 201 })
  } catch (err) {
    console.error('[posts POST]', err)
    return NextResponse.json(
      { success: false, error: 'Failed to create post' },
      { status: 500 }
    )
  }
}
