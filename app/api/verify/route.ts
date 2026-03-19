import { NextRequest, NextResponse } from 'next/server'
import { type ISuccessResult } from '@worldcoin/minikit-js'
import { verifyWorldIdProof, verifyWorldIdProofCloud, getLatestWorldChainBlock } from '@/lib/worldid'
import { getOrCreateUser, getUserByNullifier, setWorldIdVerified, setRegistrationTxHash } from '@/lib/db/users'
import { registerNullifierOnchain } from '@/lib/registry'
import { walletToNullifier } from '@/lib/serverAuth'
import { rateLimit } from '@/lib/rateLimit'

type VerifyBody =
  | { type: 'minikit'; payload: ISuccessResult; walletAddress?: string; signal?: string }
  | { type: 'idkit'; idkitResult: Record<string, unknown> }

/** Validates and parses the verify request body. Supports both MiniKit and IDKit payloads. */
function parseVerifyBody(raw: unknown): VerifyBody | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const body = raw as Record<string, unknown>

  // IDKit v4 flow: raw IDKit result forwarded for cloud verification
  if (body.idkitResult && typeof body.idkitResult === 'object') {
    return { type: 'idkit', idkitResult: body.idkitResult as Record<string, unknown> }
  }

  // MiniKit flow: legacy v3 payload with merkle_root, nullifier_hash, proof
  const p = body.payload
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null
  const proof = p as Record<string, unknown>
  if (typeof proof.merkle_root !== 'string' || typeof proof.nullifier_hash !== 'string' || typeof proof.proof !== 'string') return null
  const result: VerifyBody = { type: 'minikit', payload: p as ISuccessResult }
  if (typeof body.walletAddress === 'string') result.walletAddress = body.walletAddress
  if (typeof body.signal === 'string') result.signal = body.signal
  return result
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

/** Handles "already verified" - restores session from DB if possible */
async function tryRestoreSession(nullifierHash: string): Promise<NextResponse | null> {
  const NULLIFIER_RE = /^0x[0-9a-fA-F]{1,64}$/
  if (!nullifierHash || !NULLIFIER_RE.test(nullifierHash)) return null

  const existingUser = await getUserByNullifier(nullifierHash)
  if (!existingUser) return null

  const { nullifierHash: sessionHash, user: sessionUser } =
    await resolveIdentity(nullifierHash, existingUser)
  await setWorldIdVerified(sessionHash)
  const restored = NextResponse.json({
    success: true,
    nullifierHash: sessionHash,
    user: sessionUser,
  })
  setCookieOnResponse(restored, sessionHash)
  return restored
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    if (!rateLimit(`verify:${ip}`, 5, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
    }

    const parsed = parseVerifyBody(await req.json())
    if (!parsed) {
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
    }

    let verifyResult: { success: boolean; nullifierHash?: string; error?: string }
    let walletAddress: string | undefined
    let clientNullifier: string | undefined

    if (parsed.type === 'idkit') {
      // IDKit flow: verify via World ID v4 cloud API
      verifyResult = await verifyWorldIdProofCloud(parsed.idkitResult)
      // Extract nullifier from the IDKit result for session restoration on duplicate
      const responses = parsed.idkitResult.responses as Array<Record<string, unknown>> | undefined
      clientNullifier = responses?.[0]?.nullifier as string | undefined
    } else {
      // MiniKit flow: verify on-chain via WorldIDRouter
      const action = process.env.NEXT_PUBLIC_ACTION_ID
      if (!action) {
        console.error('[verify/route] NEXT_PUBLIC_ACTION_ID is not configured')
        return NextResponse.json({ success: false, error: 'Verification not configured' }, { status: 500 })
      }

      // Validate walletAddress format if provided (EVM address: 0x + 40 hex chars)
      if (parsed.walletAddress !== undefined && parsed.walletAddress !== null && parsed.walletAddress !== '') {
        if (!/^0x[0-9a-fA-F]{40}$/.test(parsed.walletAddress)) {
          return NextResponse.json({ success: false, error: 'Invalid wallet address' }, { status: 400 })
        }
      }

      verifyResult = await verifyWorldIdProof(parsed.payload, action, parsed.signal)
      walletAddress = parsed.walletAddress
      clientNullifier = parsed.payload.nullifier_hash
    }

    if (!verifyResult.success || !verifyResult.nullifierHash) {
      // Graceful path: duplicate nullifier means "already verified" - restore the session
      const alreadyVerified =
        verifyResult.error?.toLowerCase().includes('already') ||
        verifyResult.error?.toLowerCase().includes('max_verifications')

      if (alreadyVerified && clientNullifier) {
        const restored = await tryRestoreSession(clientNullifier)
        if (restored) return restored
      }

      return NextResponse.json(
        { success: false, error: verifyResult.error ?? 'Verification failed' },
        { status: 400 }
      )
    }

    const nullifierHash = verifyResult.nullifierHash

    // Upsert user - idempotent, safe to call multiple times
    // Desktop IDKit users may not have a wallet; use nullifier as placeholder
    const effectiveWallet = walletAddress || `idkit_${nullifierHash.slice(0, 40)}`
    const worldIdUser = await getOrCreateUser(nullifierHash, effectiveWallet, undefined, true)

    const { nullifierHash: sessionHash, user: sessionUser } =
      await resolveIdentity(nullifierHash, worldIdUser)

    // Mark the canonical session identity as World ID verified, recording the block number
    const blockNumber = await getLatestWorldChainBlock()
    await setWorldIdVerified(sessionHash, blockNumber > 0n ? blockNumber : undefined)

    // Fire-and-forget: register nullifier in ArkoraNullifierRegistry on World Chain.
    // Only runs when REGISTRY_ADDRESS + REGISTRY_DEPLOYER_PRIVATE_KEY are set in env.
    // Never blocks or fails the verify response - purely additive.
    void registerNullifierOnchain(nullifierHash).then(async (txHash) => {
      if (txHash) await setRegistrationTxHash(sessionHash, txHash)
    })

    const updatedUser = await getUserByNullifier(sessionHash)
    const res = NextResponse.json({
      success: true,
      nullifierHash: sessionHash,
      user: updatedUser ?? sessionUser,
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
