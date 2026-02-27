import { NextResponse } from 'next/server'
import { deleteReply } from '@/lib/db/replies'
import { getCallerNullifier } from '@/lib/serverAuth'

interface Params {
  params: Promise<{ id: string }>
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const nullifierHash = await getCallerNullifier()

    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const deleted = await deleteReply(id, nullifierHash)
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Reply not found or not yours' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[replies/[id] DELETE]', err instanceof Error ? err.message : String(err))
    return NextResponse.json(
      { success: false, error: 'Failed to delete reply' },
      { status: 500 }
    )
  }
}
