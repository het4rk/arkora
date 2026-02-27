import { NextRequest, NextResponse } from 'next/server'
import { getCallerNullifier } from '@/lib/serverAuth'
import { rateLimit } from '@/lib/rateLimit'
import { recordSkinPurchase, getOwnedSkins, setActiveSkin } from '@/lib/db/skins'
import { isValidSkinId, getSkinById } from '@/lib/skins'

export async function POST(req: NextRequest) {
  const nullifierHash = await getCallerNullifier()
  if (!nullifierHash) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  }

  if (!rateLimit(`skin-purchase:${nullifierHash}`, 5, 60_000)) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
  }

  const body = (await req.json()) as { skinId?: string; txId?: string }
  const { skinId, txId } = body

  if (!skinId || !txId) {
    return NextResponse.json(
      { success: false, error: 'Missing skinId or txId' },
      { status: 400 }
    )
  }

  if (!isValidSkinId(skinId)) {
    return NextResponse.json({ success: false, error: 'Invalid skin' }, { status: 400 })
  }

  if (skinId === 'monochrome') {
    return NextResponse.json({ success: false, error: 'Monochrome is free' }, { status: 400 })
  }

  const skin = getSkinById(skinId)
  if (!skin) {
    return NextResponse.json({ success: false, error: 'Skin not found' }, { status: 400 })
  }

  // Check if already owned (hex can be re-purchased but we don't need to)
  const owned = await getOwnedSkins(nullifierHash)
  if (owned.includes(skinId)) {
    return NextResponse.json({ success: false, error: 'Already owned' }, { status: 400 })
  }

  await recordSkinPurchase(nullifierHash, skinId, String(skin.priceWld), txId)
  await setActiveSkin(nullifierHash, skinId)

  return NextResponse.json({ success: true })
}
