import { NextRequest, NextResponse } from 'next/server'
import { type ISuccessResult } from '@worldcoin/minikit-js'
import { verifyWorldIdProof, getLatestWorldChainBlock } from '@/lib/worldid'
import { getOrCreateUser, getUserByNullifier, setWorldIdVerified, setRegistrationTxHash } from '@/lib/db/users'
import { registerNullifierOnchain } from '@/lib/registry'
import { walletToNullifier } from '@/lib/serverAuth'
import { rateLimit } from '@/lib/rateLimit'

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
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    if (!rateLimit(`verify:${ip}`, 5, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
    }

    const body = (await req.json()) as RequestBody
    const { payload, action, walletAddress, signal } = body

    if (!payload || !action) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate walletAddress format if provided (EVM address: 0x + 40 hex chars)
    if (walletAddress !== undefined && walletAddress !== null && walletAddress !== '') {
      if (!/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
        return NextResponse.json({ success: false, error: 'Invalid wallet address' }, { status: 400 })
      }
    }

    // On-chain verification via WorldIDRouter on World Chain (eth_call, no gas)
    const result = await verifyWorldIdProof(payload, action, signal)

    if (!result.success || !result.nullifierHash) {
      // Graceful path: Worldcoin rejects duplicate nullifiers with "already verified".
      // The proof was still valid (real human) - restore the session from our DB.
      const alreadyVerified =
        result.error?.toLowerCase().includes('already') ||
        result.error?.toLowerCase().includes('max_verifications')

      if (alreadyVerified && payload.nullifier_hash) {
        const existingUser = await getUserByNullifier(payload.nullifier_hash)
        if (existingUser) {
          const { nullifierHash: sessionHash, user: sessionUser } =
            await resolveIdentity(payload.nullifier_hash, existingUser)
          // Ensure worldIdVerified is set - handles users created before this column existed
          await setWorldIdVerified(sessionHash)
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

    // Upsert user - idempotent, safe to call multiple times
    // Desktop IDKit users may not have a wallet; use nullifier as placeholder
    const effectiveWallet = walletAddress || `idkit_${result.nullifierHash.slice(0, 40)}`
    const worldIdUser = await getOrCreateUser(result.nullifierHash, effectiveWallet, undefined, true)

    const { nullifierHash: sessionHash, user: sessionUser } =
      await resolveIdentity(result.nullifierHash, worldIdUser)

    // Mark the canonical session identity as World ID verified, recording the block number
    const blockNumber = await getLatestWorldChainBlock()
    await setWorldIdVerified(sessionHash, blockNumber > 0n ? blockNumber : undefined)

    // Fire-and-forget: register nullifier in ArkoraNullifierRegistry on World Chain.
    // Only runs when REGISTRY_ADDRESS + REGISTRY_DEPLOYER_PRIVATE_KEY are set in env.
    // Never blocks or fails the verify response - purely additive.
    void registerNullifierOnchain(result.nullifierHash).then(async (txHash) => {
      if (txHash) await setRegistrationTxHash(sessionHash, txHash)
    })

    const updatedUser = await getUserByNullifier(sessionHash)
    const res = NextResponse.json({
      success: true,
      nullifierHash: sessionHash,
      user: {
        ...(updatedUser ?? sessionUser),
        verifiedBlockNumber: blockNumber > 0n ? Number(blockNumber) : null,
      },
    })
    setCookieOnResponse(res, sessionHash)
    return res
  } catch (err) {
    console.error('[verify/route]', err instanceof Error ? err.message : String(err))
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
