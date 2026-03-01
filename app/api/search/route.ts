import { NextRequest, NextResponse } from 'next/server'
import { searchPosts, searchBoards, searchUsers } from '@/lib/db/search'
import { rateLimit } from '@/lib/rateLimit'
import type { SearchFilter, SearchResults } from '@/lib/types'

const VALID_FILTERS = new Set<SearchFilter>(['all', 'boards', 'people', 'posts'])

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get('q') ?? ''

    if (!q.trim()) {
      return NextResponse.json({
        success: true,
        data: { boards: [], people: [], posts: [] } satisfies SearchResults,
      })
    }

    // Rate limit by IP - search is unauthenticated so we can't key on nullifier
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    if (!rateLimit(`search:${ip}`, 30, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests. Slow down.' }, { status: 429 })
    }

    const filterParam = req.nextUrl.searchParams.get('type') ?? 'all'
    const filter: SearchFilter = VALID_FILTERS.has(filterParam as SearchFilter)
      ? (filterParam as SearchFilter)
      : 'all'

    const result: SearchResults = { boards: [], people: [], posts: [] }

    if (filter === 'all') {
      const [boards, people, posts] = await Promise.all([
        searchBoards(q, 5),
        searchUsers(q, 5),
        searchPosts(q, 10),
      ])
      result.boards = boards
      result.people = people
      result.posts = posts
    } else if (filter === 'boards') {
      result.boards = await searchBoards(q, 15)
    } else if (filter === 'people') {
      result.people = await searchUsers(q, 15)
    } else {
      result.posts = await searchPosts(q, 30)
    }

    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    console.error('[search GET]', err instanceof Error ? err.message : String(err))
    return NextResponse.json(
      { success: false, error: 'Search failed' },
      { status: 500 }
    )
  }
}
