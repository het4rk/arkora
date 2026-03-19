import { NextRequest, NextResponse } from 'next/server'
import { signRequest } from '@worldcoin/idkit/signing'
import { rateLimit } from '@/lib/rateLimit'

/**
 * Generates an RP context for IDKit v4 verification requests.
 * The client fetches this before opening the IDKit widget.
 *
 * Required env vars:
 *   IDKIT_RP_ID       - RP ID from the Worldcoin Developer Portal
 *   IDKIT_SIGNING_KEY - ECDSA private key (hex) from the Developer Portal
 */
export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'anon'
  if (!rateLimit(`idkit-ctx:${ip}`, 10, 60_000)) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
  }
  const rpId = process.env.IDKIT_RP_ID
  const signingKey = process.env.IDKIT_SIGNING_KEY

  if (!rpId || !signingKey) {
    console.error('[idkit/context] Missing IDKIT_RP_ID or IDKIT_SIGNING_KEY env vars')
    return NextResponse.json(
      { success: false, error: 'IDKit signing not configured' },
      { status: 500 }
    )
  }

  const action = process.env.NEXT_PUBLIC_ACTION_ID ?? ''

  try {
    const rpSig = signRequest(action, signingKey, 300)

    return NextResponse.json({
      success: true,
      data: {
        rp_id: rpId,
        nonce: rpSig.nonce,
        created_at: rpSig.createdAt,
        expires_at: rpSig.expiresAt,
        signature: rpSig.sig,
      },
    })
  } catch (err) {
    console.error('[idkit/context] signRequest failed:', err instanceof Error ? err.message : String(err))
    return NextResponse.json(
      { success: false, error: 'Failed to generate RP context' },
      { status: 500 }
    )
  }
}
