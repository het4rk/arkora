/**
 * Client-safe karma tier utilities.
 * No DB imports — safe to use in 'use client' components.
 */

export type KarmaTier = 'newcomer' | 'contributor' | 'trusted' | 'elder'

export interface KarmaTierConfig {
  tier: KarmaTier
  label: string
  minScore: number
  color: string // Tailwind text color class
  bg: string    // Tailwind bg color class
}

export const KARMA_TIERS: KarmaTierConfig[] = [
  { tier: 'newcomer',    label: 'Newcomer',    minScore: 0,   color: 'text-text-muted',  bg: 'bg-surface-up' },
  { tier: 'contributor', label: 'Contributor', minScore: 10,  color: 'text-emerald-400', bg: 'bg-emerald-400/15' },
  { tier: 'trusted',     label: 'Trusted',     minScore: 100, color: 'text-accent',       bg: 'bg-accent/15' },
  { tier: 'elder',       label: 'Elder',       minScore: 500, color: 'text-amber-400',    bg: 'bg-amber-400/15' },
]

export function getKarmaTier(score: number): KarmaTierConfig {
  for (let i = KARMA_TIERS.length - 1; i >= 0; i--) {
    const tier = KARMA_TIERS[i]!
    if (score >= tier.minScore) return tier
  }
  return KARMA_TIERS[0]!
}
