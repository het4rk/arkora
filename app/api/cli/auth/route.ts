import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rateLimit'
import { verifyWorldIdProofCloud } from '@/lib/worldid'
import { getOrCreateUser, getUserByNullifier } from '@/lib/db/users'
import { createApiKey, countActiveKeysByOwner } from '@/lib/db/apiKeys'

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    if (!rateLimit(`cli-auth:${ip}`, 5, 60_000)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 }
      )
    }

    const body = await req.json()
    const idkitResult = body?.idkitResult
    if (!idkitResult || typeof idkitResult !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Missing idkitResult' },
        { status: 400 }
      )
    }

    // Verify the World ID proof
    const verifyResult = await verifyWorldIdProofCloud(idkitResult)

    let nullifierHash: string | undefined

    if (!verifyResult.success || !verifyResult.nullifierHash) {
      // Check if "already verified" - extract nullifier and restore session
      const alreadyVerified =
        verifyResult.error?.toLowerCase().includes('already') ||
        verifyResult.error?.toLowerCase().includes('max_verifications')

      if (alreadyVerified) {
        const responses = idkitResult.responses as Array<Record<string, unknown>> | undefined
        const clientNullifier = responses?.[0]?.nullifier as string | undefined
        if (clientNullifier) {
          const existingUser = await getUserByNullifier(clientNullifier)
          if (existingUser) {
            nullifierHash = clientNullifier
          }
        }
      }

      if (!nullifierHash) {
        return NextResponse.json(
          { success: false, error: verifyResult.error ?? 'Verification failed' },
          { status: 400 }
        )
      }
    } else {
      nullifierHash = verifyResult.nullifierHash
    }

    // Ensure user exists
    const effectiveWallet = `idkit_${nullifierHash.slice(0, 40)}`
    await getOrCreateUser(nullifierHash, effectiveWallet, undefined, true)

    // Check API key limit
    const activeKeys = await countActiveKeysByOwner(nullifierHash)
    if (activeKeys >= 5) {
      return NextResponse.json(
        { success: false, error: 'API key limit reached (max 5). Revoke an existing key in Settings.' },
        { status: 403 }
      )
    }

    // Create API key
    const { raw } = await createApiKey(nullifierHash, 'CLI (auto)')

    return NextResponse.json({
      success: true,
      data: { apiKey: raw },
    })
  } catch (err) {
    console.error('[cli/auth]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
