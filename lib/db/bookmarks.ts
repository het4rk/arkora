import { db } from './index'
import { bookmarks, posts } from './schema'
import { eq, and, desc, isNull, inArray, sql } from 'drizzle-orm'
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
    deletedAt: row.deletedAt ?? null,
    quotedPostId: row.quotedPostId ?? null,
    quotedPost: null,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    countryCode: row.countryCode ?? null,
    type: (row.type as 'text' | 'poll') ?? 'text',
    pollOptions: (row.pollOptions as { index: number; text: string }[] | null) ?? null,
    pollEndsAt: row.pollEndsAt ?? null,
    contentHash: row.contentHash ?? null,
  }
}

export async function toggleBookmark(
  nullifierHash: string,
  postId: string
): Promise<boolean> {
  // Atomic: DELETE first. If deleted → was bookmarked → return false.
  // Nothing deleted → not bookmarked → INSERT with conflict guard → return true.
  const deleted = await db
    .delete(bookmarks)
    .where(and(eq(bookmarks.nullifierHash, nullifierHash), eq(bookmarks.postId, postId)))
    .returning({ postId: bookmarks.postId })

  if (deleted.length > 0) return false

  await db.insert(bookmarks).values({ nullifierHash, postId }).onConflictDoNothing()
  return true
}

export async function isBookmarked(nullifierHash: string, postId: string): Promise<boolean> {
  const [row] = await db
    .select({ v: sql<number>`1` })
    .from(bookmarks)
    .where(and(eq(bookmarks.nullifierHash, nullifierHash), eq(bookmarks.postId, postId)))
    .limit(1)
  return !!row
}

/** Returns the subset of postIds that are bookmarked by this user. */
export async function getBulkBookmarkStatus(
  nullifierHash: string,
  postIds: string[]
): Promise<string[]> {
  if (postIds.length === 0) return []
  const rows = await db
    .select({ postId: bookmarks.postId })
    .from(bookmarks)
    .where(and(eq(bookmarks.nullifierHash, nullifierHash), inArray(bookmarks.postId, postIds)))
  return rows.map((r) => r.postId)
}

export async function getBookmarksByNullifier(
  nullifierHash: string,
  limit = 30
): Promise<Post[]> {
  const rows = await db
    .select({ post: posts })
    .from(bookmarks)
    .innerJoin(posts, and(eq(bookmarks.postId, posts.id), isNull(posts.deletedAt)))
    .where(eq(bookmarks.nullifierHash, nullifierHash))
    .orderBy(desc(bookmarks.createdAt))
    .limit(Math.min(limit, 50))

  return rows.map(({ post }) => toPost(post))
}
