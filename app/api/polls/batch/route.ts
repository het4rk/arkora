import { NextRequest, NextResponse } from 'next/server'
import { getPollResultsBatch, getUserVotesBatch } from '@/lib/db/polls'
import { getCallerNullifier } from '@/lib/serverAuth'
import { rateLimit } from '@/lib/rateLimit'
import type { PollResult } from '@/lib/types'

export async function GET(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    if (!rateLimit(`poll-batch:${ip}`, 60, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests.' }, { status: 429 })
    }

    const { searchParams } = new URL(req.url)
    const postIdsParam = searchParams.get('postIds') ?? ''
    const postIds = postIdsParam.split(',').filter(Boolean).slice(0, 50)

    if (postIds.length === 0) {
      return NextResponse.json({ success: true, data: {} })
    }

    const nullifierHash = await getCallerNullifier()

    const [resultsMap, userVotesMap] = await Promise.all([
      getPollResultsBatch(postIds),
      nullifierHash ? getUserVotesBatch(postIds, nullifierHash) : Promise.resolve({} as Record<string, number>),
    ])

    const data: Record<string, { results: PollResult[]; userVote: number | null }> = {}
    for (const postId of postIds) {
      data[postId] = {
        results: resultsMap[postId] ?? [],
        userVote: userVotesMap[postId] !== undefined ? userVotesMap[postId]! : null,
      }
    }

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[polls/batch GET]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Failed to fetch poll data' }, { status: 500 })
  }
}
