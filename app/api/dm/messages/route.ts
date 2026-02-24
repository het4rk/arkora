import { NextRequest, NextResponse } from 'next/server'
import { saveDmMessage, getDmMessages } from '@/lib/db/dm'
import { isVerifiedHuman } from '@/lib/db/users'
import { createNotification } from '@/lib/db/notifications'
import { rateLimit } from '@/lib/rateLimit'
import { getCallerNullifier } from '@/lib/serverAuth'

// GET /api/dm/messages?otherHash=&cursor=&since=
// myHash is derived from the auth cookie — never trusted from query params
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const otherHash = searchParams.get('otherHash')
    const cursor = searchParams.get('cursor') ?? undefined
    const since = searchParams.get('since') ?? undefined

    const myHash = await getCallerNullifier()
    if (!myHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    if (!otherHash) {
      return NextResponse.json({ success: false, error: 'otherHash required' }, { status: 400 })
    }

    const messages = await getDmMessages(myHash, otherHash, cursor, since)
    return NextResponse.json({ success: true, data: messages })
  } catch (err) {
    console.error('[dm/messages GET]', err)
    return NextResponse.json({ success: false, error: 'Failed to fetch messages' }, { status: 500 })
  }
}

// POST /api/dm/messages — store encrypted message
// senderHash is derived from the auth cookie — never trusted from body
export async function POST(req: NextRequest) {
  try {
    const { recipientHash, ciphertext, nonce } = (await req.json()) as {
      recipientHash?: string
      ciphertext?: string
      nonce?: string
    }

    const senderHash = await getCallerNullifier()
    if (!senderHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    if (!recipientHash || !ciphertext || !nonce) {
      return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 })
    }
    if (senderHash === recipientHash) {
      return NextResponse.json({ success: false, error: 'Cannot DM yourself' }, { status: 400 })
    }
    if (!rateLimit(`dm:${senderHash}`, 30, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many messages. Slow down.' }, { status: 429 })
    }
    if (!(await isVerifiedHuman(senderHash))) {
      return NextResponse.json({ success: false, error: 'Not verified' }, { status: 403 })
    }

    const id = await saveDmMessage(senderHash, recipientHash, ciphertext, nonce)

    // Notify recipient — fire-and-forget
    void createNotification(recipientHash, 'dm', undefined, senderHash)

    return NextResponse.json({ success: true, data: { id } }, { status: 201 })
  } catch (err) {
    console.error('[dm/messages POST]', err)
    return NextResponse.json({ success: false, error: 'Failed to send message' }, { status: 500 })
  }
}
