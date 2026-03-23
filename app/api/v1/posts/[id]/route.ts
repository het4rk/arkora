import { NextRequest, NextResponse } from 'next/server'
import { requireApiKey, CORS_HEADERS } from '@/lib/apiKeyAuth'
import { rateLimit } from '@/lib/rateLimit'
import { getPostById } from '@/lib/db/posts'
import { getRepliesByPostId } from '@/lib/db/replies'
import { getPollResults } from '@/lib/db/polls'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiKey(req)
  if (auth instanceof NextResponse) return auth

  if (!(await rateLimit(`v1post-id:${auth.key}`, 120, 60_000))) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429, headers: CORS_HEADERS }
    )
  }

  const { id } = await params

  try {
    const post = await getPostById(id)
    if (!post) {
      return NextResponse.json(
        { success: false, error: 'Post not found' },
        { status: 404, headers: CORS_HEADERS }
      )
    }

    const { replies } = await getRepliesByPostId(id, { limit: 500 })

    let pollResults: { optionIndex: number; count: number }[] | null = null
    if (post.type === 'poll') {
      pollResults = await getPollResults(id)
    }

    const safePost = {
      id: post.id,
      title: post.title,
      body: post.body,
      boardId: post.boardId,
      type: post.type,
      imageUrl: post.imageUrl ?? null,
      upvotes: post.upvotes,
      downvotes: post.downvotes,
      replyCount: post.replyCount,
      viewCount: post.viewCount,
      createdAt: post.createdAt,
      author: {
        handle: post.pseudoHandle ?? null,
        isVerified: true,
      },
    }

    const safeReplies = replies.map((r) => ({
      id: r.id,
      body: r.body,
      upvotes: r.upvotes,
      downvotes: r.downvotes,
      createdAt: r.createdAt,
      parentReplyId: r.parentReplyId,
      author: {
        handle: r.pseudoHandle ?? null,
      },
    }))

    return NextResponse.json(
      {
        success: true,
        data: {
          post: safePost,
          replies: safeReplies,
          pollResults,
        },
      },
      { headers: CORS_HEADERS }
    )
  } catch (err) {
    console.error('[v1/posts/[id] GET]', err instanceof Error ? err.message : String(err))
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
