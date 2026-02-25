import { NextRequest, NextResponse } from 'next/server'
import { createCommunityNote } from '@/lib/db/communityNotes'
import { sanitizeText } from '@/lib/sanitize'
import { isVerifiedHuman } from '@/lib/db/users'
import { rateLimit } from '@/lib/rateLimit'
import { getCallerNullifier } from '@/lib/serverAuth'

// POST /api/community-notes — submit a note on a post
export async function POST(req: NextRequest) {
  try {
    const submitterNullifierHash = await getCallerNullifier()
    if (!submitterNullifierHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { postId, body } = (await req.json()) as {
      postId?: string
      body?: string
    }

    if (!postId || !body?.trim()) {
      return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 })
    }
    if (body.length > 500) {
      return NextResponse.json({ success: false, error: 'Note too long (500 chars max)' }, { status: 400 })
    }
    if (!rateLimit(`note:${submitterNullifierHash}`, 3, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many notes. Try again in a minute.' }, { status: 429 })
    }
    if (!(await isVerifiedHuman(submitterNullifierHash))) {
      return NextResponse.json({ success: false, error: 'Not verified' }, { status: 403 })
    }

    const note = await createCommunityNote(postId, sanitizeText(body), submitterNullifierHash)
    return NextResponse.json({ success: true, data: note }, { status: 201 })
  } catch (err) {
    console.error('[community-notes POST]', err)
    return NextResponse.json({ success: false, error: 'Failed to submit note' }, { status: 500 })
  }
}
