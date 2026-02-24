import { NextResponse } from 'next/server'

/**
 * POST /api/signout
 * Clears all server-side session cookies so the user is fully logged out.
 * Client is responsible for also clearing Zustand state via store.signOut().
 */
export async function POST() {
  const res = NextResponse.json({ success: true })

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: 0, // expire immediately
  }

  res.cookies.set('arkora-nh', '', cookieOptions)
  res.cookies.set('wallet-address', '', cookieOptions)
  res.cookies.set('siwe-nonce', '', cookieOptions)

  return res
}
