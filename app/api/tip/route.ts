import { NextRequest, NextResponse } from 'next/server'
import { recordTip } from '@/lib/db/tips'
import { isVerifiedHuman, getUserByNullifier } from '@/lib/db/users'
import { rateLimit } from '@/lib/rateLimit'
import { getCallerNullifier } from '@/lib/serverAuth'
import { worldAppNotify } from '@/lib/worldAppNotify'

export async function POST(req: NextRequest) {
  try {
    const senderHash = await getCallerNullifier()
    if (!senderHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { recipientHash, amountWld, txId } = (await req.json()) as {
      recipientHash?: string
      amountWld?: string
      txId?: string
    }

    if (!recipientHash || !amountWld || !txId) {
      return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 })
    }

    const amount = parseFloat(amountWld)
    if (isNaN(amount) || amount <= 0 || amount > 1000) {
      return NextResponse.json({ success: false, error: 'Invalid amount' }, { status: 400 })
    }

    if (!rateLimit(`tip:${senderHash}`, 10, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many tips. Slow down.' }, { status: 429 })
    }

    if (!(await isVerifiedHuman(senderHash))) {
      return NextResponse.json({ success: false, error: 'Not verified' }, { status: 403 })
    }

    const recipient = await getUserByNullifier(recipientHash)
    if (!recipient) {
      return NextResponse.json({ success: false, error: 'Recipient not found' }, { status: 404 })
    }

    await recordTip(senderHash, recipientHash, recipient.walletAddress, amountWld, txId)

    void worldAppNotify(
      recipientHash,
      'You received a tip',
      `${amountWld} WLD from a verified human`,
      `/u/${encodeURIComponent(recipientHash)}`
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[tip POST]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Failed to record tip' }, { status: 500 })
  }
}
