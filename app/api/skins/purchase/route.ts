import { NextRequest, NextResponse } from 'next/server'
import { getCallerNullifier, getLinkedNullifiers } from '@/lib/serverAuth'
import { rateLimit } from '@/lib/rateLimit'
import { recordSkinPurchase, getOwnedSkinsByNullifiers, setActiveSkin } from '@/lib/db/skins'
import { isValidSkinId, getSkinById } from '@/lib/skins'
import { isPaymentBlocked } from '@/lib/geo'

export async function POST(req: NextRequest) {
  if (isPaymentBlocked(req)) {
    return NextResponse.json({ success: false, error: 'In-app payments are not available in your region' }, { status: 451 })
  }

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

  // Check if already owned across all linked identities
  const nullifiers = await getLinkedNullifiers(nullifierHash)
  const owned = await getOwnedSkinsByNullifiers(nullifiers)
  if (owned.includes(skinId)) {
    return NextResponse.json({ success: false, error: 'Already owned' }, { status: 400 })
  }

  await recordSkinPurchase(nullifierHash, skinId, String(skin.priceWld), txId)
  await setActiveSkin(nullifierHash, skinId)

  return NextResponse.json({ success: true })
}
