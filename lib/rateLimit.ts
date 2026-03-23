/**
 * Sliding-window rate limiter with Upstash Redis backend.
 *
 * When UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set, uses
 * cross-instance Redis enforcement (survives Vercel cold starts).
 * Falls back to in-memory store when env vars are missing (dev / local).
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// ---------------------------------------------------------------------------
// Redis-backed limiter (production)
// ---------------------------------------------------------------------------

const redisAvailable = !!(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
)

const redis = redisAvailable
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null

// Cache of Ratelimit instances keyed by "limit:windowMs"
const limiters = new Map<string, Ratelimit>()

function getRedisLimiter(limit: number, windowMs: number): Ratelimit {
  const cacheKey = `${limit}:${windowMs}`
  let rl = limiters.get(cacheKey)
  if (!rl) {
    rl = new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
      analytics: false,
      prefix: 'arkora-rl',
    })
    limiters.set(cacheKey, rl)
  }
  return rl
}

// ---------------------------------------------------------------------------
// In-memory fallback (dev / missing env vars)
// ---------------------------------------------------------------------------

const memStore = new Map<string, number[]>()

let cleanupScheduled = false
function scheduleCleanup() {
  if (cleanupScheduled) return
  cleanupScheduled = true
  setTimeout(() => {
    const cutoff = Date.now() - 5 * 60_000
    for (const [key, hits] of memStore.entries()) {
      if (hits.every((t) => t < cutoff)) memStore.delete(key)
    }
    cleanupScheduled = false
  }, 60_000)
}

function memRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const cutoff = now - windowMs
  const hits = (memStore.get(key) ?? []).filter((t) => t > cutoff)
  if (hits.length >= limit) {
    scheduleCleanup()
    return false
  }
  hits.push(now)
  memStore.set(key, hits)
  scheduleCleanup()
  return true
}

// ---------------------------------------------------------------------------
// Public API (same signature as before - drop-in replacement)
// ---------------------------------------------------------------------------

/**
 * Returns true if the request is allowed, false if the limit is exceeded.
 * Uses Redis when available, otherwise falls back to in-memory.
 * @param key      Unique key for this action (e.g. `post:${nullifierHash}`)
 * @param limit    Max requests allowed in the window
 * @param windowMs Window size in milliseconds
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  if (!redis) {
    return memRateLimit(key, limit, windowMs)
  }

  const rl = getRedisLimiter(limit, windowMs)
  try {
    const result = await rl.limit(key)
    return result.success
  } catch {
    // Redis down - fall back to in-memory
    return memRateLimit(key, limit, windowMs)
  }
}
