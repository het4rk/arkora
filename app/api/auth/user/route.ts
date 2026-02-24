import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser, updateAvatarUrl, updateBio, updateIdentityMode } from '@/lib/db/users'

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
    const { walletAddress, username } = (await req.json()) as { walletAddress: string; username?: string }

    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing walletAddress' },
        { status: 400 }
      )
    }

    const nullifierHash = walletToNullifier(walletAddress)
    const user = await getOrCreateUser(nullifierHash, walletAddress, username ?? undefined)

    return NextResponse.json({ success: true, nullifierHash, user })
  } catch (err) {
    console.error('[auth/user]', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      nullifierHash?: string
      avatarUrl?: string | null
      bio?: string | null
      identityMode?: 'anonymous' | 'alias' | 'named'
    }
    const { nullifierHash, avatarUrl, bio, identityMode } = body
    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'nullifierHash required' }, { status: 400 })
    }
    let user
    if (avatarUrl !== undefined) {
      user = await updateAvatarUrl(nullifierHash, avatarUrl ?? null)
    } else if (bio !== undefined) {
      user = await updateBio(nullifierHash, bio ?? null)
    } else if (identityMode !== undefined) {
      await updateIdentityMode(nullifierHash, identityMode)
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 })
    }
    return NextResponse.json({ success: true, user })
  } catch (err) {
    console.error('[auth/user PATCH]', err)
    return NextResponse.json({ success: false, error: 'Failed to update user' }, { status: 500 })
  }
}
