import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Use fake timers to control Date.now() and setTimeout
beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

// Import after timer setup so module-level Date.now() calls use fake time
const getRL = () => import('@/lib/rateLimit').then((m) => m.rateLimit)

describe('rateLimit', () => {
  it('allows requests under the limit', async () => {
    const rl = await getRL()
    const key = `test-under-${Date.now()}-${Math.random()}`
    expect(rl(key, 3, 1000)).toBe(true)
    expect(rl(key, 3, 1000)).toBe(true)
    expect(rl(key, 3, 1000)).toBe(true)
  })

  it('blocks the request that exceeds the limit', async () => {
    const rl = await getRL()
    const key = `test-exceed-${Date.now()}-${Math.random()}`
    rl(key, 2, 1000)
    rl(key, 2, 1000)
    expect(rl(key, 2, 1000)).toBe(false)
  })

  it('allows requests again after the window expires', async () => {
    const rl = await getRL()
    const key = `test-window-${Date.now()}-${Math.random()}`
    const windowMs = 1000

    rl(key, 2, windowMs)
    rl(key, 2, windowMs)
    expect(rl(key, 2, windowMs)).toBe(false)

    // Advance time past the window
    vi.advanceTimersByTime(windowMs + 1)

    expect(rl(key, 2, windowMs)).toBe(true)
  })

  it('uses a sliding window (not fixed window)', async () => {
    const rl = await getRL()
    const key = `test-sliding-${Date.now()}-${Math.random()}`
    const windowMs = 1000

    // Hit at t=0
    rl(key, 2, windowMs)
    // Hit at t=600ms
    vi.advanceTimersByTime(600)
    rl(key, 2, windowMs)
    // At t=700ms limit is hit
    vi.advanceTimersByTime(100)
    expect(rl(key, 2, windowMs)).toBe(false)

    // At t=1100ms the first hit (t=0) has expired but second (t=600ms) hasn't
    vi.advanceTimersByTime(400) // now at 1100ms
    // Second hit is still within window (600ms + 1000ms = 1600ms), so still 1 hit in window
    expect(rl(key, 2, windowMs)).toBe(true)
  })

  it('different keys are tracked independently', async () => {
    const rl = await getRL()
    const keyA = `test-key-a-${Math.random()}`
    const keyB = `test-key-b-${Math.random()}`

    rl(keyA, 1, 1000)
    expect(rl(keyA, 1, 1000)).toBe(false)
    // keyB is unaffected
    expect(rl(keyB, 1, 1000)).toBe(true)
  })

  it('limit of 1 allows exactly one request', async () => {
    const rl = await getRL()
    const key = `test-limit1-${Math.random()}`
    expect(rl(key, 1, 1000)).toBe(true)
    expect(rl(key, 1, 1000)).toBe(false)
  })
})
