import { db } from '@/lib/db'
import { skinPurchases, humanUsers } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'

export async function recordSkinPurchase(
  buyerHash: string,
  skinId: string,
  amountWld: string,
  txId: string | null
): Promise<void> {
  await db
    .insert(skinPurchases)
    .values({ buyerHash, skinId, amountWld, txId })
    .onConflictDoNothing()
}

export async function getOwnedSkins(buyerHash: string): Promise<string[]> {
  const rows = await db
    .select({ skinId: skinPurchases.skinId })
    .from(skinPurchases)
    .where(eq(skinPurchases.buyerHash, buyerHash))
  return rows.map((r) => r.skinId)
}

/** Query owned skins across all linked nullifiers (handles split wlt_/0x identities). */
export async function getOwnedSkinsByNullifiers(nullifiers: string[]): Promise<string[]> {
  if (nullifiers.length === 0) return []
  if (nullifiers.length === 1) return getOwnedSkins(nullifiers[0]!)
  const rows = await db
    .select({ skinId: skinPurchases.skinId })
    .from(skinPurchases)
    .where(inArray(skinPurchases.buyerHash, nullifiers))
  // Deduplicate in case same skin was bought under both identities
  return [...new Set(rows.map((r) => r.skinId))]
}

export async function setActiveSkin(
  nullifierHash: string,
  skinId: string,
  customHex?: string | null
): Promise<void> {
  await db
    .update(humanUsers)
    .set({ activeSkinId: skinId, customHex: customHex ?? null })
    .where(eq(humanUsers.nullifierHash, nullifierHash))
}

export async function getActiveSkin(
  nullifierHash: string
): Promise<{ skinId: string; customHex: string | null }> {
  const [row] = await db
    .select({
      skinId: humanUsers.activeSkinId,
      customHex: humanUsers.customHex,
    })
    .from(humanUsers)
    .where(eq(humanUsers.nullifierHash, nullifierHash))
    .limit(1)
  return {
    skinId: row?.skinId ?? 'monochrome',
    customHex: row?.customHex ?? null,
  }
}

/** Get active skin checking all linked identities - picks first non-default. */
export async function getActiveSkinForNullifiers(
  nullifiers: string[]
): Promise<{ skinId: string; customHex: string | null }> {
  if (nullifiers.length === 0) return { skinId: 'monochrome', customHex: null }
  if (nullifiers.length === 1) return getActiveSkin(nullifiers[0]!)
  const rows = await db
    .select({
      skinId: humanUsers.activeSkinId,
      customHex: humanUsers.customHex,
    })
    .from(humanUsers)
    .where(inArray(humanUsers.nullifierHash, nullifiers))
  const nonDefault = rows.find((r) => r.skinId && r.skinId !== 'monochrome')
  return nonDefault
    ? { skinId: nonDefault.skinId!, customHex: nonDefault.customHex }
    : { skinId: rows[0]?.skinId ?? 'monochrome', customHex: rows[0]?.customHex ?? null }
}
