import { NextRequest, NextResponse } from 'next/server'
import { searchPosts } from '@/lib/db/search'
import { rateLimit } from '@/lib/rateLimit'

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get('q') ?? ''

    if (!q.trim()) {
      return NextResponse.json({ success: true, data: [] })
    }

    // Rate limit by IP — search is unauthenticated so we can't key on nullifier
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    if (!rateLimit(`search:${ip}`, 30, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests. Slow down.' }, { status: 429 })
    }

    const parsedLimit = parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10)
    const limit = Math.min(Number.isNaN(parsedLimit) ? 20 : parsedLimit, 50)

    const results = await searchPosts(q, limit)
    return NextResponse.json({ success: true, data: results })
  } catch (err) {
    console.error('[search GET]', err)
    return NextResponse.json(
      { success: false, error: 'Search failed' },
      { status: 500 }
    )
  }
}
