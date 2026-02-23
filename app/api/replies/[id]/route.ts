import { NextRequest, NextResponse } from 'next/server'
import { softDeleteReply } from '@/lib/db/replies'
import { isVerifiedHuman } from '@/lib/db/users'

interface Params {
  params: Promise<{ id: string }>
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const body = (await req.json()) as { nullifierHash?: string }
    const { nullifierHash } = body

    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'nullifierHash required' }, { status: 400 })
    }

    if (!(await isVerifiedHuman(nullifierHash))) {
      return NextResponse.json({ success: false, error: 'Not verified' }, { status: 403 })
    }

    const deleted = await softDeleteReply(id, nullifierHash)
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Reply not found or not yours' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[replies/[id] DELETE]', err)
    return NextResponse.json(
      { success: false, error: 'Failed to delete reply' },
      { status: 500 }
    )
  }
}
