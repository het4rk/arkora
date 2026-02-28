import { NextRequest, NextResponse } from 'next/server'
import { getCallerNullifier } from '@/lib/serverAuth'
import { revokeApiKey } from '@/lib/db/apiKeys'

interface Params {
  params: Promise<{ id: string }>
}

/**
 * DELETE /api/v1/keys/[id]
 * Revokes an API key. The key must belong to the authenticated user.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const nullifierHash = await getCallerNullifier()
  if (!nullifierHash) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const revoked = await revokeApiKey(id, nullifierHash)
    if (!revoked) {
      return NextResponse.json(
        { success: false, error: 'Key not found or already revoked.' },
        { status: 404 }
      )
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[v1/keys/[id] DELETE]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
