/**
 * Client-safe karma tier utilities.
 * No DB imports - safe to use in 'use client' components.
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
  { tier: 'newcomer',    label: 'Newcomer',    minScore: 0,   color: 'text-text-muted',     bg: 'bg-surface-up' },
  { tier: 'contributor', label: 'Contributor', minScore: 10,  color: 'text-text-secondary', bg: 'bg-text-secondary/10' },
  { tier: 'trusted',     label: 'Trusted',     minScore: 100, color: 'text-accent',          bg: 'bg-accent/12' },
  { tier: 'elder',       label: 'Elder',       minScore: 500, color: 'text-text',             bg: 'bg-text/10' },
]

export function getKarmaTier(score: number): KarmaTierConfig {
  for (let i = KARMA_TIERS.length - 1; i >= 0; i--) {
    const tier = KARMA_TIERS[i]!
    if (score >= tier.minScore) return tier
  }
  return KARMA_TIERS[0]!
}
