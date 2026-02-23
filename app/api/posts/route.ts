import { NextRequest, NextResponse } from 'next/server'
import { getFeed, createPost } from '@/lib/db/posts'
import { isVerifiedHuman } from '@/lib/db/users'
import type { BoardId, CreatePostInput, FeedParams } from '@/lib/types'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const params: FeedParams = {
      boardId: (searchParams.get('boardId') as BoardId) ?? undefined,
      cursor: searchParams.get('cursor') ?? undefined,
      limit: parseInt(searchParams.get('limit') ?? '10', 10),
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

    // Gate: must be a verified human
    const verified = await isVerifiedHuman(nullifierHash)
    if (!verified) {
      return NextResponse.json(
        { success: false, error: 'World ID verification required' },
        { status: 403 }
      )
    }

    const post = await createPost({ title, body: postBody, boardId, nullifierHash, pseudoHandle })
    return NextResponse.json({ success: true, data: post }, { status: 201 })
  } catch (err) {
    console.error('[posts POST]', err)
    return NextResponse.json(
      { success: false, error: 'Failed to create post' },
      { status: 500 }
    )
  }
}
