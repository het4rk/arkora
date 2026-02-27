import { NextRequest, NextResponse } from 'next/server'
import { getCallerNullifier, walletToNullifier } from '@/lib/serverAuth'
import { getUserByNullifier } from '@/lib/db/users'
import { rateLimit } from '@/lib/rateLimit'

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'anon'
  if (!rateLimit(`me:${ip}`, 60, 60_000)) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
  }

  const nullifierHash = await getCallerNullifier()
  if (!nullifierHash) {
    return NextResponse.json({ success: true, nullifierHash: null, user: null })
  }

  const user = await getUserByNullifier(nullifierHash)
  if (!user) {
    return NextResponse.json({ success: true, nullifierHash: null, user: null })
  }

  // If this is a World ID session (0x...) but the user has a real wallet address,
  // prefer the wallet identity - it holds the posts, bio, and username.
  if (
    !nullifierHash.startsWith('wlt_') &&
    user.walletAddress &&
    !user.walletAddress.startsWith('idkit_')
  ) {
    const wltNullifier = walletToNullifier(user.walletAddress)
    const walletUser = await getUserByNullifier(wltNullifier)
    if (walletUser) {
      return NextResponse.json({ success: true, nullifierHash: wltNullifier, user: walletUser })
    }
  }

  return NextResponse.json({ success: true, nullifierHash, user })
}
