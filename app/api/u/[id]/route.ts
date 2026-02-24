import { NextRequest, NextResponse } from 'next/server'
import { getUserByNullifier } from '@/lib/db/users'
import { getPostsByNullifier } from '@/lib/db/posts'
import { getPublicProfileData, isFollowing } from '@/lib/db/follows'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id: nullifierHash } = await params
    const viewerHash = new URL(req.url).searchParams.get('viewerHash')

    const [user, posts, profileStats, following] = await Promise.all([
      getUserByNullifier(nullifierHash),
      getPostsByNullifier(nullifierHash, undefined, 30),
      getPublicProfileData(nullifierHash),
      viewerHash ? isFollowing(viewerHash, nullifierHash) : Promise.resolve(false),
    ])

    return NextResponse.json({
      success: true,
      data: {
        user,
        posts,
        ...profileStats,
        isFollowing: following,
      },
    })
  } catch (err) {
    console.error('[u/[id] GET]', err)
    return NextResponse.json({ success: false, error: 'Failed to fetch profile' }, { status: 500 })
  }
}
