/**
 * Simple in-memory sliding-window rate limiter.
 *
 * Works per server instance — on Vercel each serverless invocation is a fresh process,
 * so this store lives for the lifetime of one warm instance and provides burst protection.
 * Upgrade to Upstash Redis when you need cross-instance enforcement at scale.
 */

const store = new Map<string, number[]>()

// Periodic cleanup: sweep entries where every timestamp is older than 5 minutes.
// Scheduled lazily (at most once per minute) to avoid blocking request handlers.
let cleanupScheduled = false
function scheduleCleanup() {
  if (cleanupScheduled) return
  cleanupScheduled = true
  setTimeout(() => {
    const cutoff = Date.now() - 5 * 60_000
    for (const [key, hits] of store.entries()) {
      if (hits.every((t) => t < cutoff)) store.delete(key)
    }
    cleanupScheduled = false
  }, 60_000)
}

/**
 * Returns true if the request is allowed, false if the limit is exceeded.
 * @param key      Unique key for this action (e.g. `post:${nullifierHash}`)
 * @param limit    Max requests allowed in the window
 * @param windowMs Window size in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const cutoff = now - windowMs
  const hits = (store.get(key) ?? []).filter((t) => t > cutoff)
  if (hits.length >= limit) {
    scheduleCleanup()
    return false
  }
  hits.push(now)
  store.set(key, hits)
  scheduleCleanup()
  return true
}
