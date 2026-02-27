import { db } from './index'
import { follows, posts, humanUsers } from './schema'
import { eq, and, desc, lt, sql } from 'drizzle-orm'
import type { Post, BoardId } from '@/lib/types'

function toPost(row: typeof posts.$inferSelect): Post {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    boardId: row.boardId as BoardId,
    nullifierHash: row.nullifierHash,
    pseudoHandle: row.pseudoHandle ?? null,
    sessionTag: row.sessionTag,
    imageUrl: row.imageUrl ?? null,
    upvotes: row.upvotes,
    downvotes: row.downvotes,
    replyCount: row.replyCount,
    quoteCount: row.quoteCount,
    createdAt: row.createdAt,
    quotedPostId: row.quotedPostId ?? null,
    quotedPost: null,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    countryCode: row.countryCode ?? null,
    type: (row.type as 'text' | 'poll' | 'repost') ?? 'text',
    pollOptions: (row.pollOptions as { index: number; text: string }[] | null) ?? null,
    pollEndsAt: row.pollEndsAt ?? null,
    contentHash: row.contentHash ?? null,
  }
}

export async function toggleFollow(followerId: string, followedId: string): Promise<boolean> {
  // Atomic 2-query pattern: try DELETE first.
  // Rows deleted → was following → return false (unfollowed).
  // Nothing deleted → not following → INSERT with conflict guard → return true.
  const deleted = await db
    .delete(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followedId, followedId)))
    .returning({ followerId: follows.followerId })

  if (deleted.length > 0) return false

  await db.insert(follows).values({ followerId, followedId }).onConflictDoNothing()
  return true
}

export async function isFollowing(followerId: string, followedId: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followedId, followedId)))
    .limit(1)
  return !!row
}

export async function getFollowerCount(nullifierHash: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(follows)
    .where(eq(follows.followedId, nullifierHash))
  return result[0]?.count ?? 0
}

export async function getFollowingCount(nullifierHash: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(follows)
    .where(eq(follows.followerId, nullifierHash))
  return result[0]?.count ?? 0
}

export async function getFollowingIds(nullifierHash: string): Promise<string[]> {
  const rows = await db
    .select({ followedId: follows.followedId })
    .from(follows)
    .where(eq(follows.followerId, nullifierHash))
  return rows.map((r) => r.followedId)
}

export async function getFeedFollowing(
  nullifierHash: string,
  cursor?: string,
  limit = 20
): Promise<Post[]> {
  // Single JOIN query - no separate getFollowingIds round-trip.
  const conditions = [
    eq(follows.followerId, nullifierHash),
    lt(posts.reportCount, 5),
  ]
  if (cursor) conditions.push(lt(posts.createdAt, new Date(cursor)))

  const rows = await db
    .select({ post: posts })
    .from(posts)
    .innerJoin(follows, eq(follows.followedId, posts.nullifierHash))
    .where(and(...conditions))
    .orderBy(desc(posts.createdAt))
    .limit(Math.min(limit, 50))

  return rows.map((r) => toPost(r.post))
}

export async function getPublicProfileData(
  nullifierHash: string
): Promise<{ followerCount: number; followingCount: number; postCount: number }> {
  const [followerCount, followingCount, postCountResult] = await Promise.all([
    getFollowerCount(nullifierHash),
    getFollowingCount(nullifierHash),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(posts)
      .where(eq(posts.nullifierHash, nullifierHash)),
  ])
  return {
    followerCount,
    followingCount,
    postCount: postCountResult[0]?.count ?? 0,
  }
}
