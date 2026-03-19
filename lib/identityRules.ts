import { createHash } from 'crypto'

export type IdentityMode = 'anonymous' | 'alias' | 'named'

// ── Sub-identity derivation ──────────────────────────────────────────────────

/** Deterministic alias nullifier - persistent pseudonym, NOT linkable to real identity. */
export function deriveAliasNullifier(realNullifier: string): string {
  return createHash('sha256').update(`${realNullifier}:alias`).digest('hex')
}

/** Per-post anonymous nullifier - unique per post, completely unlinkable. */
export function deriveAnonNullifier(realNullifier: string, postId: string): string {
  return createHash('sha256').update(`${realNullifier}:anon:${postId}`).digest('hex')
}

/** Resolve which nullifier to expose in API responses based on identity mode. */
export function getPublicNullifier(
  realNullifier: string,
  mode: IdentityMode,
  postId?: string
): string {
  switch (mode) {
    case 'named':
      return realNullifier
    case 'alias':
      return deriveAliasNullifier(realNullifier)
    case 'anonymous':
      if (!postId) return deriveAliasNullifier(realNullifier) // fallback for edge cases
      return deriveAnonNullifier(realNullifier, postId)
  }
}

// ── Interaction permission checks ────────────────────────────────────────────

export function canFollow(actorMode: IdentityMode, targetMode: IdentityMode): boolean {
  // Only named users can follow, and only named targets
  return actorMode === 'named' && targetMode === 'named'
}

export function canDM(actorMode: IdentityMode, targetMode: IdentityMode): boolean {
  return actorMode === 'named' && targetMode === 'named'
}

export function canTip(actorMode: IdentityMode, targetMode: IdentityMode): boolean {
  // Anonymous cannot tip. Alias and named can tip named targets only.
  return actorMode !== 'anonymous' && targetMode === 'named'
}

export function hasProfile(mode: IdentityMode): boolean {
  return mode === 'named'
}

export function isBadgeTappable(postMode: IdentityMode): boolean {
  return postMode === 'named'
}
