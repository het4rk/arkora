import { NextRequest, NextResponse } from 'next/server'
import { getCallerNullifier, getLinkedNullifiers } from '@/lib/serverAuth'
import { getOwnedSkinsByNullifiers, setActiveSkin } from '@/lib/db/skins'
import { isValidSkinId } from '@/lib/skins'
import { rateLimit } from '@/lib/rateLimit'

export async function PATCH(req: NextRequest) {
  try {
    const nullifierHash = await getCallerNullifier()
    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    }

    if (!rateLimit(`skin-activate:${nullifierHash}`, 30, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
    }

    const body = (await req.json()) as { skinId?: string; customHex?: string }
    const { skinId, customHex } = body

    if (!skinId) {
      return NextResponse.json({ success: false, error: 'Missing skinId' }, { status: 400 })
    }

    if (!isValidSkinId(skinId)) {
      return NextResponse.json({ success: false, error: 'Invalid skin' }, { status: 400 })
    }

    // Monochrome is always available
    if (skinId !== 'monochrome') {
      const nullifiers = await getLinkedNullifiers(nullifierHash)
      const owned = await getOwnedSkinsByNullifiers(nullifiers)
      if (!owned.includes(skinId)) {
        return NextResponse.json({ success: false, error: 'Skin not owned' }, { status: 403 })
      }
    }

    // Validate customHex for hex unlock
    if (skinId === 'hex') {
      if (!customHex || !/^#[0-9A-Fa-f]{6}$/.test(customHex)) {
        return NextResponse.json(
          { success: false, error: 'Invalid hex color (use #RRGGBB format)' },
          { status: 400 }
        )
      }
    }

    await setActiveSkin(nullifierHash, skinId, skinId === 'hex' ? customHex : null)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[skins/activate PATCH]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Failed to activate skin' }, { status: 500 })
  }
}
