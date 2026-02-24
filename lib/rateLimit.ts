/**
 * Simple in-memory sliding-window rate limiter.
 * Works per server instance — acceptable for Vercel serverless at current scale.
 * Upgrade to Redis (e.g. Upstash) when you need cross-instance enforcement.
 */

const store = new Map<string, number[]>()

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
  if (hits.length >= limit) return false
  hits.push(now)
  store.set(key, hits)
  return true
}
