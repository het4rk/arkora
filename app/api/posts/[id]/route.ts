import { NextRequest, NextResponse } from 'next/server'
import { getPostById, deletePost, recordView, getPostAuthorNullifier } from '@/lib/db/posts'
import { getRepliesByPostId } from '@/lib/db/replies'
import { getNotesByPostId } from '@/lib/db/communityNotes'
import { getPollResults, getUserVote } from '@/lib/db/polls'
import { getKarmaScore } from '@/lib/db/karma'
import { getCallerNullifier } from '@/lib/serverAuth'
import { invalidatePosts } from '@/lib/cache'
import { rateLimit } from '@/lib/rateLimit'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? 'anon'
    if (!(await rateLimit(`postdetail:${ip}`, 120, 60_000))) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
    }

    const { id } = await params
    const url = new URL(req.url)
    const cursorParam = url.searchParams.get('cursor')
    const limitParam = url.searchParams.get('limit')
    const paginationOpts: { cursor?: string; limit?: number } = {}
    if (cursorParam) paginationOpts.cursor = cursorParam
    if (limitParam) paginationOpts.limit = Math.min(Math.max(parseInt(limitParam, 10) || 20, 1), 100)

    const [post, repliesResult, notes] = await Promise.all([
      getPostById(id),
      getRepliesByPostId(id, paginationOpts),
      getNotesByPostId(id),
    ])

    if (!post) {
      return NextResponse.json(
        { success: false, error: 'Post not found' },
        { status: 404 }
      )
    }

    const nullifierHash = await getCallerNullifier()

    // Fire-and-forget: record view without blocking the response
    if (nullifierHash) void recordView(id, nullifierHash)

    // Fetch author karma + poll data in parallel
    const [authorKarmaScore, pollResultsRaw, userVoteRaw] = await Promise.all([
      getKarmaScore(post.nullifierHash),
      post.type === 'poll' ? getPollResults(id) : Promise.resolve(null),
      post.type === 'poll' && nullifierHash ? getUserVote(id, nullifierHash) : Promise.resolve(null),
    ])

    const pollResults = pollResultsRaw ?? null
    const userVote = userVoteRaw ?? null

    // Determine ownership using authorNullifier (internal) - safe to expose as a boolean
    let isOwner = false
    if (nullifierHash) {
      const authorNullifier = await getPostAuthorNullifier(id)
      isOwner = authorNullifier === nullifierHash || post.nullifierHash === nullifierHash
    }

    return NextResponse.json({ success: true, data: { post, replies: repliesResult.replies, nextCursor: repliesResult.nextCursor, notes, pollResults, userVote, authorKarmaScore, isOwner } })
  } catch (err) {
    console.error('[posts/[id] GET]', err instanceof Error ? err.message : String(err))
    return NextResponse.json(
      { success: false, error: 'Failed to fetch post' },
      { status: 500 }
    )
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const nullifierHash = await getCallerNullifier()

    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const deleted = await deletePost(id, nullifierHash)
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Post not found or not yours' },
        { status: 404 }
      )
    }

    invalidatePosts()
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[posts/[id] DELETE]', err instanceof Error ? err.message : String(err))
    return NextResponse.json(
      { success: false, error: 'Failed to delete post' },
      { status: 500 }
    )
  }
}
