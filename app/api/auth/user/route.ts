import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser, updateBio, updateIdentityMode, updatePseudoHandle, getUserByWalletAddressNonWlt, getUserByNullifier } from '@/lib/db/users'
import { getCallerNullifier, walletToNullifier } from '@/lib/serverAuth'
import { sanitizeLine, sanitizeText } from '@/lib/sanitize'
import { rateLimit } from '@/lib/rateLimit'

const VALID_IDENTITY_MODES = new Set(['anonymous', 'alias', 'named'])

/** Returns the authenticated user from the session cookie. Used by ProfileView to refresh stale store data. */
export async function GET(req: NextRequest) {
  try {
    const nullifierHash = await getCallerNullifier()
    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const ip = req.headers.get('x-forwarded-for') ?? 'anon'
    if (!rateLimit(`auth-user-get:${ip}`, 60, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
    }
    const user = await getUserByNullifier(nullifierHash)
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, user })
  } catch (err) {
    console.error('[auth/user GET]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
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

    // Rate limit: 10 registrations per 60s per wallet prefix
    if (!rateLimit(`auth-user:${walletAddress.slice(0, 10)}`, 10, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
    }

    // Sanitize and length-cap username before storing
    const sanitizedUsername = username ? sanitizeLine(username).slice(0, 50) : undefined

    const nullifierHash = walletToNullifier(walletAddress)
    // worldIdVerified: false — wallet-auth only, requires World ID verify to unlock actions
    let user = await getOrCreateUser(nullifierHash, walletAddress, sanitizedUsername, false)

    // One-time migration: copy pseudoHandle and bio from the linked World ID record if
    // the wlt_ record is missing either (happens when users set data before wallet auth).
    if (!user.pseudoHandle || !user.bio) {
      const worldIdRecord = await getUserByWalletAddressNonWlt(walletAddress)
      if (worldIdRecord) {
        if (!user.pseudoHandle && worldIdRecord.pseudoHandle) {
          user = await updatePseudoHandle(nullifierHash, worldIdRecord.pseudoHandle)
        }
        if (!user.bio && worldIdRecord.bio) {
          user = await updateBio(nullifierHash, worldIdRecord.bio)
        }
      }
    }

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
    console.error('[auth/user]', err instanceof Error ? err.message : String(err))
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

    if (!rateLimit(`auth-user-patch:${nullifierHash}`, 10, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
    }

    const body = (await req.json()) as {
      bio?: string | null
      identityMode?: string
      pseudoHandle?: string | null
    }
    const { bio, identityMode, pseudoHandle } = body
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
    } else if (pseudoHandle !== undefined) {
      const sanitized = pseudoHandle ? sanitizeLine(pseudoHandle).slice(0, 50) : null
      if (!sanitized) {
        return NextResponse.json({ success: false, error: 'Handle cannot be empty' }, { status: 400 })
      }
      user = await updatePseudoHandle(nullifierHash, sanitized)
      return NextResponse.json({ success: true, user })
    } else {
      return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 })
    }
    return NextResponse.json({ success: true, user })
  } catch (err) {
    console.error('[auth/user PATCH]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Failed to update user' }, { status: 500 })
  }
}
