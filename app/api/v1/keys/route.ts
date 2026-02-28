import { NextRequest, NextResponse } from 'next/server'
import { getCallerNullifier } from '@/lib/serverAuth'
import { createApiKey, getApiKeysByOwner, countActiveKeysByOwner } from '@/lib/db/apiKeys'
import { rateLimit } from '@/lib/rateLimit'

/**
 * GET /api/v1/keys
 * Lists all API keys for the authenticated user (requires World ID session cookie).
 * Raw key values are never returned - only metadata.
 */
export async function GET() {
  const nullifierHash = await getCallerNullifier()
  if (!nullifierHash) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const keys = await getApiKeysByOwner(nullifierHash)
    return NextResponse.json({ success: true, data: keys })
  } catch (err) {
    console.error('[v1/keys GET]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/v1/keys
 * Creates a new API key for the authenticated user (requires World ID session cookie).
 * The raw key is returned exactly once - it cannot be retrieved again.
 * Maximum 5 active keys per account.
 *
 * Body: { label?: string }
 * Response: { id, label, createdAt, key: "ark_..." }
 */
export async function POST(req: NextRequest) {
  const nullifierHash = await getCallerNullifier()
  if (!nullifierHash) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (!rateLimit(`apikeys:${nullifierHash}`, 5, 60_000)) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
  }

  try {
    const activeCount = await countActiveKeysByOwner(nullifierHash)
    if (activeCount >= 5) {
      return NextResponse.json(
        { success: false, error: 'Maximum 5 active API keys per account. Revoke one to create a new key.' },
        { status: 422 }
      )
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const label = typeof body.label === 'string' ? body.label.trim().slice(0, 64) : ''

    const result = await createApiKey(nullifierHash, label)

    return NextResponse.json(
      {
        success: true,
        data: {
          id: result.id,
          label: result.label,
          createdAt: result.createdAt,
          key: result.raw,
        },
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('[v1/keys POST]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
