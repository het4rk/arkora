import { NextRequest, NextResponse } from 'next/server'
import {
  upsertSubscription,
  getActiveSubscription,
  cancelSubscription,
} from '@/lib/db/subscriptions'
import { isVerifiedHuman, getUserByNullifier } from '@/lib/db/users'
import { rateLimit } from '@/lib/rateLimit'
import { getCallerNullifier, getLinkedNullifiers } from '@/lib/serverAuth'
import { isPaymentBlocked } from '@/lib/geo'
import { isValidTxId } from '@/lib/txValidation'

function daysLeft(expiresAt: Date): number {
  return Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000))
}

export async function GET(req: NextRequest) {
  try {
    const subscriberHash = await getCallerNullifier()
    if (!subscriberHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!rateLimit(`subscribe-get:${subscriberHash}`, 60, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
    }

    const creatorHash = new URL(req.url).searchParams.get('creatorHash')
    if (!creatorHash) {
      return NextResponse.json({ success: false, error: 'Missing params' }, { status: 400 })
    }

    const sub = await getActiveSubscription(subscriberHash, creatorHash)
    if (!sub) {
      return NextResponse.json({ success: true, data: { isSubscribed: false } })
    }

    return NextResponse.json({
      success: true,
      data: {
        isSubscribed: true,
        expiresAt: sub.expiresAt,
        daysLeft: daysLeft(sub.expiresAt),
      },
    })
  } catch (err) {
    console.error('[subscribe GET]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Failed to fetch subscription' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (isPaymentBlocked(req)) {
      return NextResponse.json({ success: false, error: 'In-app payments are not available in your region' }, { status: 451 })
    }

    const subscriberHash = await getCallerNullifier()
    if (!subscriberHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { creatorHash, amountWld = '1', txId } = (await req.json()) as {
      creatorHash?: string
      amountWld?: string
      txId?: string
    }

    if (!creatorHash || !txId) {
      return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 })
    }

    if (!isValidTxId(txId)) {
      return NextResponse.json({ success: false, error: 'Invalid transaction ID format' }, { status: 400 })
    }

    const allLinked = await getLinkedNullifiers(subscriberHash)
    if (allLinked.includes(creatorHash)) {
      return NextResponse.json({ success: false, error: 'Cannot subscribe to yourself' }, { status: 400 })
    }

    const parsedAmount = parseFloat(amountWld)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid WLD amount' }, { status: 400 })
    }

    if (!rateLimit(`subscribe:${subscriberHash}`, 5, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
    }

    if (!(await isVerifiedHuman(subscriberHash))) {
      return NextResponse.json({ success: false, error: 'Not verified' }, { status: 403 })
    }

    // Both subscriber and creator must be in named mode
    const [subscriber, creator] = await Promise.all([
      getUserByNullifier(subscriberHash),
      getUserByNullifier(creatorHash),
    ])
    if (!creator) {
      return NextResponse.json({ success: false, error: 'Creator not found' }, { status: 404 })
    }
    if (subscriber?.identityMode !== 'named') {
      return NextResponse.json({ success: false, error: 'Subscriptions require named mode' }, { status: 403 })
    }
    if (creator.identityMode !== 'named' || !(await isVerifiedHuman(creatorHash))) {
      return NextResponse.json({ success: false, error: 'Subscriptions are only available for verified named profiles' }, { status: 403 })
    }

    const sub = await upsertSubscription(subscriberHash, creatorHash, creator.walletAddress, amountWld, txId)
    return NextResponse.json({
      success: true,
      data: {
        isSubscribed: true,
        expiresAt: sub?.expiresAt,
        daysLeft: sub ? daysLeft(sub.expiresAt) : 30,
      },
    })
  } catch (err) {
    console.error('[subscribe POST]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Failed to subscribe' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const callerHash = await getCallerNullifier()
    if (!callerHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!rateLimit(`subscribe-delete:${callerHash}`, 10, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
    }

    const { creatorHash } = (await req.json()) as {
      creatorHash?: string
    }

    if (!creatorHash) {
      return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 })
    }

    await cancelSubscription(callerHash, creatorHash)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[subscribe DELETE]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Failed to cancel subscription' }, { status: 500 })
  }
}
