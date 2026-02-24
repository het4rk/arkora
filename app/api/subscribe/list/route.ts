import { NextResponse } from 'next/server'
import { getActiveSubscriptions } from '@/lib/db/subscriptions'
import { getUserByNullifier } from '@/lib/db/users'
import { getCallerNullifier } from '@/lib/serverAuth'

export async function GET() {
  try {
    const subscriberHash = await getCallerNullifier()
    if (!subscriberHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const rows = await getActiveSubscriptions(subscriberHash)

    // Enrich with creator profile info (name for display in Settings)
    const data = await Promise.all(
      rows.map(async (r) => {
        const creator = await getUserByNullifier(r.creatorHash)
        return {
          creatorHash: r.creatorHash,
          creatorWallet: r.creatorWallet,
          amountWld: r.amountWld,
          expiresAt: r.expiresAt instanceof Date ? r.expiresAt.toISOString() : String(r.expiresAt),
          daysLeft: Math.max(0, Math.ceil((new Date(r.expiresAt).getTime() - Date.now()) / 86_400_000)),
          creatorName: creator?.pseudoHandle ?? null,
        }
      })
    )

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[subscribe/list GET]', err)
    return NextResponse.json({ success: false, error: 'Failed to fetch subscriptions' }, { status: 500 })
  }
}
