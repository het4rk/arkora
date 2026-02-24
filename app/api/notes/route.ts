import { NextRequest, NextResponse } from 'next/server'
import { createNote, voteOnNote } from '@/lib/db/notes'
import { isVerifiedHuman } from '@/lib/db/users'
import { getCallerNullifier } from '@/lib/serverAuth'

export async function POST(req: NextRequest) {
  try {
    const submitterNullifierHash = await getCallerNullifier()
    if (!submitterNullifierHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json()) as { postId?: string; body?: string }
    const { postId, body: noteBody } = body

    if (!postId || !noteBody?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const verified = await isVerifiedHuman(submitterNullifierHash)
    if (!verified) {
      return NextResponse.json(
        { success: false, error: 'World ID verification required' },
        { status: 403 }
      )
    }

    const note = await createNote({ postId, body: noteBody, submitterNullifierHash })
    return NextResponse.json({ success: true, data: note }, { status: 201 })
  } catch (err) {
    console.error('[notes POST]', err)
    return NextResponse.json(
      { success: false, error: 'Failed to create note' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const nullifierHash = await getCallerNullifier()
    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json()) as { noteId?: string; isHelpful?: boolean }
    const { noteId, isHelpful } = body

    if (!noteId || typeof isHelpful !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid fields' },
        { status: 400 }
      )
    }

    const verified = await isVerifiedHuman(nullifierHash)
    if (!verified) {
      return NextResponse.json(
        { success: false, error: 'World ID verification required' },
        { status: 403 }
      )
    }

    const note = await voteOnNote(noteId, isHelpful)
    return NextResponse.json({ success: true, data: note })
  } catch (err) {
    console.error('[notes PATCH]', err)
    return NextResponse.json(
      { success: false, error: 'Failed to vote on note' },
      { status: 500 }
    )
  }
}
