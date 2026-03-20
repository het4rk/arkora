import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rateLimit'
import { getCallerNullifier } from '@/lib/serverAuth'
import { getPendingCliSession, authorizeCliSession } from '@/lib/db/cliSessions'
import { createApiKey, countActiveKeysByOwner, revokeApiKey } from '@/lib/db/apiKeys'

const TOKEN_RE = /^[0-9a-f]{64}$/

export async function POST(req: NextRequest) {
  try {
    const nullifierHash = await getCallerNullifier()
    if (!nullifierHash) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    if (!rateLimit(`cli-authorize:${nullifierHash}`, 10, 60_000)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 }
      )
    }

    const body = await req.json()
    const token = body?.token
    if (typeof token !== 'string' || !TOKEN_RE.test(token)) {
      return NextResponse.json(
        { success: false, error: 'Invalid token format' },
        { status: 400 }
      )
    }

    const session = await getPendingCliSession(token)
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session expired or already authorized' },
        { status: 404 }
      )
    }

    const activeKeys = await countActiveKeysByOwner(nullifierHash)
    if (activeKeys >= 5) {
      return NextResponse.json(
        { success: false, error: 'API key limit reached (max 5). Revoke an existing key first.' },
        { status: 403 }
      )
    }

    const { raw, id: keyId } = await createApiKey(nullifierHash, 'CLI (auto)')
    const ok = await authorizeCliSession(token, nullifierHash, raw)
    if (!ok) {
      // Revoke orphaned key since session was already consumed
      await revokeApiKey(keyId, nullifierHash)
      return NextResponse.json(
        { success: false, error: 'Session expired or already authorized' },
        { status: 409 }
      )
    }

    return NextResponse.json({ success: true, data: { authorized: true } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cli/authorize]', msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
