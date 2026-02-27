import { unstable_cache, revalidateTag } from 'next/cache'
import { getFeed, getLocalFeed, getHotFeed } from '@/lib/db/posts'
import type { FeedParams, LocalFeedParams } from '@/lib/types'

/**
 * Cached version of the main feed (forYou + board feeds).
 * These are the same for all users on a given set of params, so we cache at
 * the route level. Revalidates every 15 s or immediately when invalidatePosts()
 * is called (e.g. after creating or deleting a post).
 */
export const getCachedFeed = unstable_cache(
  (params: FeedParams) => getFeed(params),
  ['feed'],
  { revalidate: 15, tags: ['posts'] }
)

/**
 * Cached version of the local (country-scoped) feed.
 * Same behaviour as getCachedFeed - revalidates on new/deleted posts.
 */
export const getCachedLocalFeed = unstable_cache(
  (params: LocalFeedParams) => getLocalFeed(params),
  ['local-feed'],
  { revalidate: 15, tags: ['posts'] }
)

/**
 * Cached version of the hot feed (Wilson-score time-decay ranking).
 * Revalidates every 60 s (or on new/deleted post) - longer TTL is fine since
 * the ranking changes slowly and the query is more expensive.
 */
export const getCachedHotFeed = unstable_cache(
  (boardId?: string) => getHotFeed(boardId),
  ['hot-feed'],
  { revalidate: 60, tags: ['posts'] }
)

// ── Invalidation helpers ─────────────────────────────────────────────────────

/** Call after creating or deleting a post to flush feed caches. */
export function invalidatePosts(): void {
  revalidateTag('posts')
}
