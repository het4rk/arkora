import { createHash } from 'crypto'
import { cookies } from 'next/headers'

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
