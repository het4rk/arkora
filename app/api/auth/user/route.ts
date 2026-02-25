import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser, updateBio, updateIdentityMode } from '@/lib/db/users'
import { getCallerNullifier } from '@/lib/serverAuth'
import { sanitizeText } from '@/lib/sanitize'

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

    const res = NextResponse.json({ success: true, nullifierHash, user })
    // Set server-side identity cookie so protected endpoints can verify the caller
    res.cookies.set('arkora-nh', nullifierHash, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })
    return res
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
    // Identity always comes from the server-set cookie, never from the request body
    const nullifierHash = await getCallerNullifier()
    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json()) as {
      bio?: string | null
      identityMode?: 'anonymous' | 'alias' | 'named'
    }
    const { bio, identityMode } = body
    let user
    if (bio !== undefined) {
      user = await updateBio(nullifierHash, bio ? sanitizeText(bio) : null)
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
