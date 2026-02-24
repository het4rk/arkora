import { NextRequest, NextResponse } from 'next/server'
import { voteOnNote, deleteNoteVote } from '@/lib/db/communityNotes'
import { isVerifiedHuman } from '@/lib/db/users'
import { rateLimit } from '@/lib/rateLimit'
import { getCallerNullifier } from '@/lib/serverAuth'

export async function POST(req: NextRequest) {
  try {
    const nullifierHash = await getCallerNullifier()
    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { noteId, helpful } = (await req.json()) as {
      noteId?: string
      helpful?: boolean | null
    }

    if (!noteId || (typeof helpful !== 'boolean' && helpful !== null)) {
      return NextResponse.json({ success: false, error: 'Missing or invalid fields' }, { status: 400 })
    }
    if (!rateLimit(`note-vote:${nullifierHash}`, 10, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many votes. Slow down.' }, { status: 429 })
    }
    if (!(await isVerifiedHuman(nullifierHash))) {
      return NextResponse.json({ success: false, error: 'Not verified' }, { status: 403 })
    }

    const note = helpful === null
      ? await deleteNoteVote(noteId, nullifierHash)
      : await voteOnNote(noteId, nullifierHash, helpful)
    return NextResponse.json({ success: true, data: note })
  } catch (err) {
    console.error('[community-notes/vote POST]', err)
    return NextResponse.json({ success: false, error: 'Failed to vote on note' }, { status: 500 })
  }
}
