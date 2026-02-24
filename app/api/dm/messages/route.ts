import { NextRequest, NextResponse } from 'next/server'
import { saveDmMessage, getDmMessages } from '@/lib/db/dm'
import { isVerifiedHuman } from '@/lib/db/users'

// GET /api/dm/messages?myHash=&otherHash=&cursor=
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const myHash = searchParams.get('myHash')
    const otherHash = searchParams.get('otherHash')
    const cursor = searchParams.get('cursor') ?? undefined

    if (!myHash || !otherHash) {
      return NextResponse.json({ success: false, error: 'myHash and otherHash required' }, { status: 400 })
    }
    if (!(await isVerifiedHuman(myHash))) {
      return NextResponse.json({ success: false, error: 'Not verified' }, { status: 403 })
    }

    const messages = await getDmMessages(myHash, otherHash, cursor)
    return NextResponse.json({ success: true, data: messages })
  } catch (err) {
    console.error('[dm/messages GET]', err)
    return NextResponse.json({ success: false, error: 'Failed to fetch messages' }, { status: 500 })
  }
}

// POST /api/dm/messages — store encrypted message
export async function POST(req: NextRequest) {
  try {
    const { senderHash, recipientHash, ciphertext, nonce } = (await req.json()) as {
      senderHash?: string
      recipientHash?: string
      ciphertext?: string
      nonce?: string
    }

    if (!senderHash || !recipientHash || !ciphertext || !nonce) {
      return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 })
    }
    if (senderHash === recipientHash) {
      return NextResponse.json({ success: false, error: 'Cannot DM yourself' }, { status: 400 })
    }
    if (!(await isVerifiedHuman(senderHash))) {
      return NextResponse.json({ success: false, error: 'Not verified' }, { status: 403 })
    }

    const id = await saveDmMessage(senderHash, recipientHash, ciphertext, nonce)
    return NextResponse.json({ success: true, data: { id } }, { status: 201 })
  } catch (err) {
    console.error('[dm/messages POST]', err)
    return NextResponse.json({ success: false, error: 'Failed to send message' }, { status: 500 })
  }
}
