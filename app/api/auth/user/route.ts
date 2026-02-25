import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser, updateBio, updateIdentityMode } from '@/lib/db/users'
import { getCallerNullifier, walletToNullifier } from '@/lib/serverAuth'
import { sanitizeLine, sanitizeText } from '@/lib/sanitize'

const VALID_IDENTITY_MODES = new Set(['anonymous', 'alias', 'named'])

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, username } = (await req.json()) as { walletAddress: string; username?: string }

    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing walletAddress' },
        { status: 400 }
      )
    }

    // Sanitize and length-cap username before storing
    const sanitizedUsername = username ? sanitizeLine(username).slice(0, 50) : undefined

    const nullifierHash = walletToNullifier(walletAddress)
    const user = await getOrCreateUser(nullifierHash, walletAddress, sanitizedUsername)

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
      identityMode?: string
    }
    const { bio, identityMode } = body
    let user
    if (bio !== undefined) {
      if (bio && bio.length > 500) {
        return NextResponse.json({ success: false, error: 'Bio exceeds 500 characters' }, { status: 400 })
      }
      user = await updateBio(nullifierHash, bio ? sanitizeText(bio) : null)
    } else if (identityMode !== undefined) {
      if (!VALID_IDENTITY_MODES.has(identityMode)) {
        return NextResponse.json({ success: false, error: 'Invalid identity mode' }, { status: 400 })
      }
      await updateIdentityMode(nullifierHash, identityMode as 'anonymous' | 'alias' | 'named')
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
