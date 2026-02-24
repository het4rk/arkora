import { NextRequest, NextResponse } from 'next/server'
import {
  upsertSubscription,
  getActiveSubscription,
  cancelSubscription,
} from '@/lib/db/subscriptions'
import { isVerifiedHuman, getUserByNullifier } from '@/lib/db/users'
import { rateLimit } from '@/lib/rateLimit'

function daysLeft(expiresAt: Date): number {
  return Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000))
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const subscriberHash = searchParams.get('subscriberHash')
    const creatorHash = searchParams.get('creatorHash')

    if (!subscriberHash || !creatorHash) {
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
    console.error('[subscribe GET]', err)
    return NextResponse.json({ success: false, error: 'Failed to fetch subscription' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { subscriberHash, creatorHash, amountWld = '1', txId } = (await req.json()) as {
      subscriberHash?: string
      creatorHash?: string
      amountWld?: string
      txId?: string
    }

    if (!subscriberHash || !creatorHash) {
      return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 })
    }

    if (!rateLimit(`subscribe:${subscriberHash}`, 5, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
    }

    if (!(await isVerifiedHuman(subscriberHash))) {
      return NextResponse.json({ success: false, error: 'Not verified' }, { status: 403 })
    }

    const creator = await getUserByNullifier(creatorHash)
    if (!creator) {
      return NextResponse.json({ success: false, error: 'Creator not found' }, { status: 404 })
    }
    if (creator.identityMode !== 'named') {
      return NextResponse.json({ success: false, error: 'Subscriptions are only available for named profiles' }, { status: 403 })
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
    console.error('[subscribe POST]', err)
    return NextResponse.json({ success: false, error: 'Failed to subscribe' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { subscriberHash, creatorHash } = (await req.json()) as {
      subscriberHash?: string
      creatorHash?: string
    }

    if (!subscriberHash || !creatorHash) {
      return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 })
    }

    await cancelSubscription(subscriberHash, creatorHash)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[subscribe DELETE]', err)
    return NextResponse.json({ success: false, error: 'Failed to cancel subscription' }, { status: 500 })
  }
}
