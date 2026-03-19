import { cookies, headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rateLimit'

export async function GET() {
  try {
    const headerStore = await headers()
    const ip = headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    if (!rateLimit(`nonce:${ip}`, 10, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
    }

    // Must be >= 8 alphanumeric characters per MiniKit spec
    const nonce = crypto.randomUUID().replace(/-/g, '')

    const cookieStore = await cookies()
    cookieStore.set('siwe-nonce', nonce, {
      secure: true,
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 60 * 10, // 10 min
    })

    return NextResponse.json({ nonce })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[nonce]', msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
