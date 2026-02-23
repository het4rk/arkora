import { NextRequest, NextResponse } from 'next/server'
import { getPostById } from '@/lib/db/posts'
import { getRepliesByPostId } from '@/lib/db/replies'
import { getNotesByPostId } from '@/lib/db/notes'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const [post, replies, notes] = await Promise.all([
      getPostById(id),
      getRepliesByPostId(id),
      getNotesByPostId(id),
    ])

    if (!post) {
      return NextResponse.json(
        { success: false, error: 'Post not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: { post, replies, notes } })
  } catch (err) {
    console.error('[posts/[id] GET]', err)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch post' },
      { status: 500 }
    )
  }
}
