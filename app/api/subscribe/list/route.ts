import { NextRequest, NextResponse } from 'next/server'
import { getActiveSubscriptions } from '@/lib/db/subscriptions'

export async function GET(req: NextRequest) {
  try {
    const subscriberHash = new URL(req.url).searchParams.get('subscriberHash')
    if (!subscriberHash) {
      return NextResponse.json({ success: false, error: 'Missing subscriberHash' }, { status: 400 })
    }

    const rows = await getActiveSubscriptions(subscriberHash)
    const data = rows.map((r) => ({
      creatorHash: r.creatorHash,
      creatorWallet: r.creatorWallet,
      amountWld: r.amountWld,
      expiresAt: r.expiresAt,
      daysLeft: Math.max(0, Math.ceil((r.expiresAt.getTime() - Date.now()) / 86_400_000)),
    }))

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[subscribe/list GET]', err)
    return NextResponse.json({ success: false, error: 'Failed to fetch subscriptions' }, { status: 500 })
  }
}
