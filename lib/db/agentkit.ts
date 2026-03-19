import type { AgentKitStorage } from '@worldcoin/agentkit'
import { db } from '@/lib/db'
import { agentkitUsage, agentkitNonces } from './schema'
import { and, eq, gte, sql } from 'drizzle-orm'

/**
 * Drizzle-backed AgentKit storage for nonce replay protection and
 * per-human usage tracking (free-trial daily quotas).
 */
export class DrizzleAgentKitStorage implements AgentKitStorage {
  async getUsageCount(endpoint: string, humanId: string): Promise<number> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const rows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(agentkitUsage)
      .where(
        and(
          eq(agentkitUsage.humanId, humanId),
          eq(agentkitUsage.endpoint, endpoint),
          gte(agentkitUsage.usedAt, oneDayAgo)
        )
      )
    return rows[0]?.count ?? 0
  }

  async incrementUsage(endpoint: string, humanId: string): Promise<void> {
    await db.insert(agentkitUsage).values({ humanId, endpoint })
  }

  async hasUsedNonce(nonce: string): Promise<boolean> {
    const rows = await db
      .select({ nonce: agentkitNonces.nonce })
      .from(agentkitNonces)
      .where(eq(agentkitNonces.nonce, nonce))
      .limit(1)
    return rows.length > 0
  }

  async recordNonce(nonce: string): Promise<void> {
    await db
      .insert(agentkitNonces)
      .values({ nonce })
      .onConflictDoNothing()
  }
}
