import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import {
  verifySiweMessage,
  type MiniAppWalletAuthSuccessPayload,
} from '@worldcoin/minikit-js'
import { rateLimit } from '@/lib/rateLimit'

/** Validates and parses the auth request body. Returns null if invalid. */
function parseAuthBody(raw: unknown): { payload: MiniAppWalletAuthSuccessPayload; nonce: string } | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const body = raw as Record<string, unknown>
  const p = body.payload
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null
  if (typeof (p as Record<string, unknown>).address !== 'string') return null
  if (typeof body.nonce !== 'string' || !/^[0-9a-f]{32}$/.test(body.nonce as string)) return null
  return { payload: p as MiniAppWalletAuthSuccessPayload, nonce: body.nonce as string }
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    if (!rateLimit(`walletauth:${ip}`, 5, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
    }

    const parsed = parseAuthBody(await req.json())
    if (!parsed) {
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
    }
    const { payload, nonce } = parsed

    const cookieStore = await cookies()
    const storedNonce = cookieStore.get('siwe-nonce')?.value

    if (!storedNonce) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired nonce' },
        { status: 400 }
      )
    }

    // Constant-time comparison prevents timing oracle attacks
    const storedBuf = Buffer.from(storedNonce, 'utf8')
    const providedBuf = Buffer.from(nonce, 'utf8')
    if (storedBuf.length !== providedBuf.length || !timingSafeEqual(storedBuf, providedBuf)) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired nonce' },
        { status: 400 }
      )
    }

    const result = await verifySiweMessage(payload, nonce)

    if (!result.isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid SIWE signature' },
        { status: 401 }
      )
    }

    // Clear nonce after use
    cookieStore.delete('siwe-nonce')

    // Store wallet session
    cookieStore.set('wallet-address', payload.address, {
      secure: true,
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    return NextResponse.json({
      success: true,
      walletAddress: payload.address,
    })
  } catch (err) {
    console.error('[auth/route]', err instanceof Error ? err.message : String(err))
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 500 }
    )
  }
}
