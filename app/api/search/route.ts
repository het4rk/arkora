import { NextRequest, NextResponse } from 'next/server'
import { searchPosts } from '@/lib/db/search'

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get('q') ?? ''

    if (!q.trim()) {
      return NextResponse.json({ success: true, data: [] })
    }

    const limit = Math.min(
      parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10),
      50
    )

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
