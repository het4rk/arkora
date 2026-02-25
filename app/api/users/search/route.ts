import { NextRequest, NextResponse } from 'next/server'
import { searchUsersByHandle } from '@/lib/db/users'
import { rateLimit } from '@/lib/rateLimit'

// GET /api/users/search?q=<prefix>&limit=5
// Returns alias/named users matching the handle prefix — used for @mention autocomplete
export async function GET(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'unknown'
    if (!rateLimit(`user-search:${ip}`, 20, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests.' }, { status: 429 })
    }

    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') ?? '').trim().slice(0, 50)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '5', 10), 10)

    if (!q) {
      return NextResponse.json({ success: true, data: [] })
    }

    const users = await searchUsersByHandle(q, limit)
    return NextResponse.json({ success: true, data: users })
  } catch (err) {
    console.error('[users/search GET]', err)
    return NextResponse.json({ success: false, error: 'Failed to search users' }, { status: 500 })
  }
}
