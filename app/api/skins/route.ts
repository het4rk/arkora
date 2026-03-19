import { NextResponse } from 'next/server'
import { getCallerNullifier, getLinkedNullifiers } from '@/lib/serverAuth'
import { getOwnedSkinsByNullifiers, getActiveSkinForNullifiers } from '@/lib/db/skins'

export async function GET() {
  try {
    const nullifierHash = await getCallerNullifier()
    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
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
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[skins]', msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
