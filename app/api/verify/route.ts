import { NextRequest, NextResponse } from 'next/server'
import { type ISuccessResult } from '@worldcoin/minikit-js'
import { verifyWorldIdProof } from '@/lib/worldid'
import { getOrCreateUser, getUserByNullifier } from '@/lib/db/users'

interface RequestBody {
  payload: ISuccessResult
  action: string
  walletAddress?: string
  signal?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RequestBody
    const { payload, action, walletAddress, signal } = body

    if (!payload || !action) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const result = await verifyWorldIdProof(payload, action, signal)

    if (!result.success || !result.nullifierHash) {
      // Graceful path: Worldcoin rejects duplicate nullifiers with "already verified".
      // The proof was still valid (real human) — restore the session from our DB.
      const alreadyVerified =
        result.error?.toLowerCase().includes('already') ||
        result.error?.toLowerCase().includes('max_verifications')

      if (alreadyVerified && payload.nullifier_hash) {
        const existingUser = await getUserByNullifier(payload.nullifier_hash)
        if (existingUser) {
          const restored = NextResponse.json({
            success: true,
            nullifierHash: payload.nullifier_hash,
            user: existingUser,
          })
          restored.cookies.set('arkora-nh', payload.nullifier_hash, {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            path: '/',
            maxAge: 60 * 60 * 24 * 30,
          })
          return restored
        }
      }

      return NextResponse.json(
        { success: false, error: result.error ?? 'Verification failed' },
        { status: 400 }
      )
    }

    // Upsert user — idempotent, safe to call multiple times
    // Desktop IDKit users may not have a wallet; use nullifier as placeholder
    const effectiveWallet = walletAddress || `idkit_${result.nullifierHash.slice(0, 40)}`
    const user = await getOrCreateUser(result.nullifierHash, effectiveWallet)

    const res = NextResponse.json({
      success: true,
      nullifierHash: result.nullifierHash,
      user,
    })
    // Set server-side identity cookie so protected endpoints can verify the caller
    res.cookies.set('arkora-nh', result.nullifierHash, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })
    return res
  } catch (err) {
    console.error('[verify/route]', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
