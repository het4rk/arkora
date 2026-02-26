import { cookies, headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rateLimit'

export async function GET() {
  const headerStore = await headers()
  const ip = headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!rateLimit(`nonce:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  // Must be >= 8 alphanumeric characters per MiniKit spec
  const nonce = crypto.randomUUID().replace(/-/g, '')

  const cookieStore = await cookies()
  cookieStore.set('siwe-nonce', nonce, {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 60 * 10, // 10 min
  })

  return NextResponse.json({ nonce })
}
