import { NextResponse } from 'next/server'
import { getCallerNullifier, getLinkedNullifiers } from '@/lib/serverAuth'
import { getOwnedFontsByNullifiers, getActiveFontForNullifiers } from '@/lib/db/fonts'

export async function GET() {
  const nullifierHash = await getCallerNullifier()
  if (!nullifierHash) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  }

  const nullifiers = await getLinkedNullifiers(nullifierHash)

  const [owned, active] = await Promise.all([
    getOwnedFontsByNullifiers(nullifiers),
    getActiveFontForNullifiers(nullifiers),
  ])

  return NextResponse.json({
    success: true,
    data: {
      owned,
      activeFontId: active.fontId,
    },
  })
}
