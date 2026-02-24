import { NextRequest, NextResponse } from 'next/server'
import { upsertDmKey, getDmKey } from '@/lib/db/dm'
import { isVerifiedHuman } from '@/lib/db/users'
import { getCallerNullifier } from '@/lib/serverAuth'

// GET /api/dm/keys?nullifierHash=xxx — fetch someone's public key
export async function GET(req: NextRequest) {
  const nullifierHash = new URL(req.url).searchParams.get('nullifierHash')
  if (!nullifierHash) {
    return NextResponse.json({ success: false, error: 'nullifierHash required' }, { status: 400 })
  }
  const publicKey = await getDmKey(nullifierHash)
  if (!publicKey) {
    return NextResponse.json({ success: false, error: 'No key registered' }, { status: 404 })
  }
  return NextResponse.json({ success: true, data: { publicKey } })
}

// POST /api/dm/keys — register/update own public key
export async function POST(req: NextRequest) {
  try {
    const nullifierHash = await getCallerNullifier()
    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const { publicKey } = (await req.json()) as { publicKey?: string }
    if (!publicKey) {
      return NextResponse.json({ success: false, error: 'publicKey required' }, { status: 400 })
    }
    if (!(await isVerifiedHuman(nullifierHash))) {
      return NextResponse.json({ success: false, error: 'Not verified' }, { status: 403 })
    }
    await upsertDmKey(nullifierHash, publicKey)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[dm/keys POST]', err)
    return NextResponse.json({ success: false, error: 'Failed to register key' }, { status: 500 })
  }
}
