import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import {
  verifySiweMessage,
  type MiniAppWalletAuthSuccessPayload,
} from '@worldcoin/minikit-js'
import { rateLimit } from '@/lib/rateLimit'

interface RequestBody {
  payload: MiniAppWalletAuthSuccessPayload
  nonce: string
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    if (!rateLimit(`walletauth:${ip}`, 5, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
    }

    const body = (await req.json()) as RequestBody
    const { payload, nonce } = body

    // Validate nonce format: must be 32 lowercase hex chars (UUID without hyphens)
    if (!nonce || !/^[0-9a-f]{32}$/.test(nonce)) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired nonce' },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    const storedNonce = cookieStore.get('siwe-nonce')?.value

    // Constant-time comparison prevents timing oracle attacks
    const storedBuf = Buffer.from(storedNonce ?? '', 'utf8')
    const providedBuf = Buffer.from(nonce, 'utf8')
    const nonceValid =
      storedBuf.length === providedBuf.length && timingSafeEqual(storedBuf, providedBuf)

    if (!storedNonce || !nonceValid) {
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
