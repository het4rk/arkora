import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/db/users'

/**
 * Derives a stable pseudonymous identity from the wallet address
 * and upserts the human_users record. Called automatically after
 * walletAuth so users are considered verified without a separate
 * World ID ZK proof step.
 *
 * The derived hash is prefixed `wlt_` to distinguish it from real
 * World ID Orb nullifiers — enabling a future upgrade path.
 */
function walletToNullifier(walletAddress: string): string {
  const hash = createHash('sha256')
    .update(walletAddress.toLowerCase())
    .digest('hex')
  return `wlt_${hash}`
}

export async function POST(req: NextRequest) {
  try {
    const { walletAddress } = (await req.json()) as { walletAddress: string }

    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing walletAddress' },
        { status: 400 }
      )
    }

    const nullifierHash = walletToNullifier(walletAddress)
    const user = await getOrCreateUser(nullifierHash, walletAddress)

    return NextResponse.json({ success: true, nullifierHash, user })
  } catch (err) {
    console.error('[auth/user]', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
