import { NextRequest, NextResponse } from 'next/server'
import { requireApiKey, CORS_HEADERS } from '@/lib/apiKeyAuth'
import { rateLimit } from '@/lib/rateLimit'
import { searchPosts, searchBoards, searchUsers } from '@/lib/db/search'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(req: NextRequest) {
  const auth = await requireApiKey(req)
  if (auth instanceof NextResponse) return auth

  if (!rateLimit(`v1search:${auth.key}`, 30, 60_000)) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429, headers: CORS_HEADERS }
    )
  }

  const { searchParams } = req.nextUrl
  const q = searchParams.get('q')?.trim()
  const type = searchParams.get('type') ?? 'all'

  if (!q) {
    return NextResponse.json(
      { success: false, error: 'Missing required query parameter: q' },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  if (!['all', 'posts', 'boards', 'people'].includes(type)) {
    return NextResponse.json(
      { success: false, error: 'type must be one of: all, posts, boards, people' },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  try {
    const [postsResult, boardsResult, peopleResult] = await Promise.all([
      type === 'all' || type === 'posts' ? searchPosts(q) : Promise.resolve([]),
      type === 'all' || type === 'boards' ? searchBoards(q) : Promise.resolve([]),
      type === 'all' || type === 'people' ? searchUsers(q) : Promise.resolve([]),
    ])

    // Strip sensitive fields from posts
    const safePosts = postsResult.map((p) => ({
      id: p.id,
      title: p.title,
      body: p.body,
      boardId: p.boardId,
      type: p.type,
      imageUrl: p.imageUrl ?? null,
      upvotes: p.upvotes,
      downvotes: p.downvotes,
      replyCount: p.replyCount,
      viewCount: p.viewCount,
      createdAt: p.createdAt,
      author: {
        handle: p.pseudoHandle ?? null,
        isVerified: true,
      },
    }))

    // Strip nullifierHash from people results
    const safePeople = peopleResult.map((p) => ({
      pseudoHandle: p.pseudoHandle,
      avatarUrl: p.avatarUrl,
      karmaScore: p.karmaScore,
    }))

    return NextResponse.json(
      {
        success: true,
        data: {
          boards: boardsResult,
          people: safePeople,
          posts: safePosts,
        },
      },
      { headers: CORS_HEADERS }
    )
  } catch (err) {
    console.error('[v1/search GET]', err instanceof Error ? err.message : String(err))
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
