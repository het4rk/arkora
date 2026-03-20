import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rateLimit'
import { consumeCliSession, getPendingCliSession } from '@/lib/db/cliSessions'

const TOKEN_RE = /^[0-9a-f]{64}$/

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token') ?? ''
    if (!TOKEN_RE.test(token)) {
      return NextResponse.json(
        { success: false, error: 'Invalid token format' },
        { status: 400 }
      )
    }

    if (!rateLimit(`cli-poll:${token}`, 60, 60_000)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 }
      )
    }

    // Try to consume an authorized session (single-use)
    const apiKey = await consumeCliSession(token)
    if (apiKey) {
      return NextResponse.json({
        success: true,
        data: { status: 'authorized', apiKey },
      })
    }

    // Check if session is still pending
    const session = await getPendingCliSession(token)
    if (session) {
      return NextResponse.json({
        success: true,
        data: { status: 'pending' },
      })
    }

    return NextResponse.json({
      success: true,
      data: { status: 'expired' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cli/poll]', msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
