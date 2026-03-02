import { createHash } from 'crypto'
import { cookies } from 'next/headers'
import { getUserByNullifier, getUserByWalletAddressNonWlt } from '@/lib/db/users'

/**
 * Reads the caller's nullifier hash from the server-side `arkora-nh` httpOnly cookie.
 * This cookie is set by both auth flows (wallet sign-in + World ID Orb verify).
 * Use this to identify the authenticated caller on protected endpoints instead of
 * trusting a hash sent in the request body/query.
 */
export async function getCallerNullifier(): Promise<string | null> {
  const cookieStore = await cookies()
  const value = cookieStore.get('arkora-nh')?.value
  if (!value) return null
  // Validate format: World ID nullifier (0x hex) or wallet-derived (wlt_ hex)
  if (!/^(wlt_)?[0-9a-fA-F]+$/.test(value)) return null
  return value
}

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/

/**
 * Derives the stable wallet-based nullifier from a wallet address.
 * Prefixed `wlt_` to distinguish from World ID Orb nullifiers.
 */
export function walletToNullifier(walletAddress: string): string {
  if (!EVM_ADDRESS_RE.test(walletAddress)) {
    throw new Error('Invalid EVM address format')
  }
  const hash = createHash('sha256')
    .update(walletAddress.toLowerCase())
    .digest('hex')
  return `wlt_${hash}`
}

/**
 * Returns all nullifiers that belong to the same real-world user.
 * A user can have content under both their World ID nullifier (0x...)
 * and their wallet-derived nullifier (wlt_...) if they verified at different times.
 * Used by purchase/profile queries to find all owned items regardless of which
 * identity the current session resolves to.
 */
export async function getLinkedNullifiers(nullifierHash: string): Promise<string[]> {
  const user = await getUserByNullifier(nullifierHash)
  if (!user?.walletAddress || user.walletAddress.startsWith('idkit_')) {
    return [nullifierHash]
  }

  const all = new Set([nullifierHash])

  if (nullifierHash.startsWith('wlt_')) {
    // Session is wallet-based - also check for linked World ID nullifier
    const wiUser = await getUserByWalletAddressNonWlt(user.walletAddress)
    if (wiUser) all.add(wiUser.nullifierHash)
  } else {
    // Session is World ID nullifier - also add linked wlt_ nullifier
    all.add(walletToNullifier(user.walletAddress))
  }

  return [...all]
}
