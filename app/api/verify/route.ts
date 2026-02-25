import { NextRequest, NextResponse } from 'next/server'
import { type ISuccessResult } from '@worldcoin/minikit-js'
import { verifyWorldIdProof } from '@/lib/worldid'
import { getOrCreateUser, getUserByNullifier } from '@/lib/db/users'
import { walletToNullifier } from '@/lib/serverAuth'

interface RequestBody {
  payload: ISuccessResult
  action: string
  walletAddress?: string
  signal?: string
}

/**
 * After World ID proof verification, prefer the wallet identity if one exists for this
 * wallet address. This ensures desktop users (who can't run WalletConnect) see the same
 * posts, bio, and name as on mobile, where the wallet identity holds all the data.
 */
async function resolveIdentity(
  worldIdNullifier: string,
  worldIdUser: Awaited<ReturnType<typeof getUserByNullifier>>
): Promise<{ nullifierHash: string; user: NonNullable<typeof worldIdUser> }> {
  if (
    worldIdUser &&
    worldIdUser.walletAddress &&
    !worldIdUser.walletAddress.startsWith('idkit_')
  ) {
    const wltNullifier = walletToNullifier(worldIdUser.walletAddress)
    const walletUser = await getUserByNullifier(wltNullifier)
    if (walletUser) {
      return { nullifierHash: wltNullifier, user: walletUser }
    }
  }
  return { nullifierHash: worldIdNullifier, user: worldIdUser! }
}

function setCookieOnResponse(res: ReturnType<typeof NextResponse.json>, nullifierHash: string) {
  res.cookies.set('arkora-nh', nullifierHash, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
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
          const { nullifierHash: sessionHash, user: sessionUser } =
            await resolveIdentity(payload.nullifier_hash, existingUser)
          const restored = NextResponse.json({
            success: true,
            nullifierHash: sessionHash,
            user: sessionUser,
          })
          setCookieOnResponse(restored, sessionHash)
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
    const worldIdUser = await getOrCreateUser(result.nullifierHash, effectiveWallet)

    const { nullifierHash: sessionHash, user: sessionUser } =
      await resolveIdentity(result.nullifierHash, worldIdUser)

    const res = NextResponse.json({
      success: true,
      nullifierHash: sessionHash,
      user: sessionUser,
    })
    setCookieOnResponse(res, sessionHash)
    return res
  } catch (err) {
    console.error('[verify/route]', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
