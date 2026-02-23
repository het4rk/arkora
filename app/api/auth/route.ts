import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import {
  verifySiweMessage,
  type MiniAppWalletAuthSuccessPayload,
} from '@worldcoin/minikit-js'

interface RequestBody {
  payload: MiniAppWalletAuthSuccessPayload
  nonce: string
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RequestBody
    const { payload, nonce } = body

    const cookieStore = await cookies()
    const storedNonce = cookieStore.get('siwe-nonce')?.value

    if (!storedNonce || storedNonce !== nonce) {
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
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    return NextResponse.json({
      success: true,
      walletAddress: payload.address,
    })
  } catch (err) {
    console.error('[auth/route]', err)
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 500 }
    )
  }
}
