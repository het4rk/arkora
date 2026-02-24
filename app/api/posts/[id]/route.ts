import { NextRequest, NextResponse } from 'next/server'
import { getPostById, softDeletePost } from '@/lib/db/posts'
import { getRepliesByPostId } from '@/lib/db/replies'
import { getNotesByPostId } from '@/lib/db/notes'
import { getCallerNullifier } from '@/lib/serverAuth'
import { invalidatePosts } from '@/lib/cache'

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

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const nullifierHash = await getCallerNullifier()

    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const deleted = await softDeletePost(id, nullifierHash)
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Post not found or not yours' },
        { status: 404 }
      )
    }

    invalidatePosts()
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[posts/[id] DELETE]', err)
    return NextResponse.json(
      { success: false, error: 'Failed to delete post' },
      { status: 500 }
    )
  }
}
