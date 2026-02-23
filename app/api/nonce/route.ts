import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
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
