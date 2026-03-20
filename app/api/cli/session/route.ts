import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rateLimit'
import { createCliSession } from '@/lib/db/cliSessions'

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? 'anon'
    if (!rateLimit(`cli-session:${ip}`, 5, 600_000)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Try again later.' },
        { status: 429 }
      )
    }

    const { token, expiresAt } = await createCliSession(ip)

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
    const verifyUrl = `${baseUrl}/cli/verify?token=${token}`

    return NextResponse.json({
      success: true,
      data: { token, verifyUrl, expiresAt: expiresAt.toISOString() },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cli/session]', msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
