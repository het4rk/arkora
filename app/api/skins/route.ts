import { NextResponse } from 'next/server'
import { getCallerNullifier, getLinkedNullifiers } from '@/lib/serverAuth'
import { getOwnedSkinsByNullifiers, getActiveSkinForNullifiers } from '@/lib/db/skins'
import { rateLimit } from '@/lib/rateLimit'

export async function GET() {
  try {
    const nullifierHash = await getCallerNullifier()
    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    }

    if (!(await rateLimit(`skins-get:${nullifierHash}`, 60, 60_000))) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
    }

    const nullifiers = await getLinkedNullifiers(nullifierHash)

    const [owned, active] = await Promise.all([
      getOwnedSkinsByNullifiers(nullifiers),
      getActiveSkinForNullifiers(nullifiers),
    ])

    return NextResponse.json({
      success: true,
      data: {
        owned,
        activeSkinId: active.skinId,
        customHex: active.customHex,
      },
    })
  } catch (err) {
    console.error('[skins]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Failed to load skins' }, { status: 500 })
  }
}
