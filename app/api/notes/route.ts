import { NextRequest, NextResponse } from 'next/server'
import { createNote, voteOnNote } from '@/lib/db/notes'
import { isVerifiedHuman } from '@/lib/db/users'
import type { CreateNoteInput } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateNoteInput

    const { postId, body: noteBody, submitterNullifierHash } = body

    if (!postId || !noteBody?.trim() || !submitterNullifierHash) {
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
    const body = (await req.json()) as {
      noteId: string
      isHelpful: boolean
      nullifierHash: string
    }

    const { noteId, isHelpful, nullifierHash } = body

    if (!noteId || typeof isHelpful !== 'boolean' || !nullifierHash) {
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
