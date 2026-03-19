import { describe, it, expect, vi, beforeEach } from 'vitest'

// Track all DB calls
const selectResult = vi.fn()
const insertResult = vi.fn()

// Separate mocks for getUsageCount (no .limit) vs hasUsedNonce (.limit)
const nonceSelectResult = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => {
          // Return an object that:
          // 1. Is thenable (resolves selectResult) for getUsageCount
          // 2. Has .limit() method (resolves nonceSelectResult) for hasUsedNonce
          return {
            then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
              selectResult().then(resolve, reject),
            limit: vi.fn(() => nonceSelectResult()),
          }
        }),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(() => insertResult()),
      })),
    })),
  },
}))

vi.mock('@/lib/env', () => ({ validateEnv: vi.fn() }))

import { DrizzleAgentKitStorage } from '@/lib/db/agentkit'
import { db } from '@/lib/db'

describe('DrizzleAgentKitStorage', () => {
  let storage: DrizzleAgentKitStorage

  beforeEach(() => {
    storage = new DrizzleAgentKitStorage()
    vi.clearAllMocks()
  })

  describe('getUsageCount', () => {
    it('returns count from DB query', async () => {
      selectResult.mockReturnValueOnce(Promise.resolve([{ count: 42 }]))
      const count = await storage.getUsageCount('v2/sentiment', 'human-abc')
      expect(count).toBe(42)
      expect(db.select).toHaveBeenCalled()
    })

    it('returns 0 when no rows', async () => {
      selectResult.mockReturnValueOnce(Promise.resolve([]))
      const count = await storage.getUsageCount('v2/trends', 'human-xyz')
      expect(count).toBe(0)
    })
  })

  describe('incrementUsage', () => {
    it('calls insert with humanId and endpoint', async () => {
      insertResult.mockResolvedValueOnce(undefined)
      await storage.incrementUsage('v2/sentiment', 'human-abc')
      expect(db.insert).toHaveBeenCalled()
    })
  })

  describe('hasUsedNonce', () => {
    it('returns true when nonce exists', async () => {
      nonceSelectResult.mockReturnValueOnce(Promise.resolve([{ nonce: 'test-nonce' }]))
      const used = await storage.hasUsedNonce('test-nonce')
      expect(used).toBe(true)
    })

    it('returns false when nonce not found', async () => {
      nonceSelectResult.mockReturnValueOnce(Promise.resolve([]))
      const used = await storage.hasUsedNonce('new-nonce')
      expect(used).toBe(false)
    })
  })

  describe('recordNonce', () => {
    it('inserts nonce with onConflictDoNothing', async () => {
      insertResult.mockResolvedValueOnce(undefined)
      await storage.recordNonce('test-nonce')
      expect(db.insert).toHaveBeenCalled()
    })
  })

  it('satisfies AgentKitStorage interface shape', () => {
    const methods = ['getUsageCount', 'incrementUsage', 'hasUsedNonce', 'recordNonce']
    for (const method of methods) {
      expect(typeof (storage as unknown as Record<string, unknown>)[method]).toBe('function')
    }
  })
})
