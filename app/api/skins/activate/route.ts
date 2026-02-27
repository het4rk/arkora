import { NextRequest, NextResponse } from 'next/server'
import { getCallerNullifier } from '@/lib/serverAuth'
import { getOwnedSkins, setActiveSkin } from '@/lib/db/skins'
import { isValidSkinId } from '@/lib/skins'

export async function PATCH(req: NextRequest) {
  const nullifierHash = await getCallerNullifier()
  if (!nullifierHash) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
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
    const owned = await getOwnedSkins(nullifierHash)
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
}
