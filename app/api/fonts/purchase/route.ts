import { NextRequest, NextResponse } from 'next/server'
import { getCallerNullifier, getLinkedNullifiers } from '@/lib/serverAuth'
import { rateLimit } from '@/lib/rateLimit'
import { recordFontPurchase, getOwnedFontsByNullifiers, setActiveFont } from '@/lib/db/fonts'
import { isValidFontId, getFontById } from '@/lib/fonts'
import { isPaymentBlocked } from '@/lib/geo'
import { isValidTxId } from '@/lib/txValidation'

export async function POST(req: NextRequest) {
  try {
    if (isPaymentBlocked(req)) {
      return NextResponse.json({ success: false, error: 'In-app payments are not available in your region' }, { status: 451 })
    }

    const nullifierHash = await getCallerNullifier()
    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    }

    if (!rateLimit(`font-purchase:${nullifierHash}`, 5, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
    }

    const body = (await req.json()) as { fontId?: string; txId?: string }
    const { fontId, txId } = body

    if (!fontId || !txId) {
      return NextResponse.json(
        { success: false, error: 'Missing fontId or txId' },
        { status: 400 }
      )
    }

    if (!isValidTxId(txId)) {
      return NextResponse.json({ success: false, error: 'Invalid transaction ID format' }, { status: 400 })
    }

    if (!isValidFontId(fontId)) {
      return NextResponse.json({ success: false, error: 'Invalid font' }, { status: 400 })
    }

    if (fontId === 'system') {
      return NextResponse.json({ success: false, error: 'System font is free' }, { status: 400 })
    }

    const font = getFontById(fontId)
    if (!font) {
      return NextResponse.json({ success: false, error: 'Font not found' }, { status: 400 })
    }

    const nullifiers = await getLinkedNullifiers(nullifierHash)
    const owned = await getOwnedFontsByNullifiers(nullifiers)
    if (owned.includes(fontId)) {
      return NextResponse.json({ success: false, error: 'Already owned' }, { status: 400 })
    }

    const recorded = await recordFontPurchase(nullifierHash, fontId, String(font.priceWld), txId)
    if (!recorded) {
      return NextResponse.json({ success: false, error: 'Transaction already used' }, { status: 400 })
    }

    await setActiveFont(nullifierHash, fontId)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[fonts/purchase POST]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Failed to purchase font' }, { status: 500 })
  }
}
