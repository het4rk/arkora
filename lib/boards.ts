/**
 * Board normalization and deduplication logic.
 *
 * When a user creates a board, the input is normalized to a URL-safe slug,
 * checked against a synonym dictionary for common topic equivalences,
 * then checked against existing board slugs via Levenshtein distance.
 * This prevents duplicate boards for typos, alternate spellings, and
 * synonymous topic names.
 */

/** Hardcoded featured boards - always shown first in the picker. */
export const FEATURED_BOARDS: { id: string; label: string }[] = [
  { id: 'arkora',      label: 'Arkora' },
  { id: 'technology',  label: 'Technology' },
  { id: 'markets',     label: 'Markets' },
  { id: 'politics',    label: 'Politics' },
  { id: 'worldchain',  label: 'World Chain' },
  { id: 'confessions', label: 'Confessions' },
]

/**
 * Terms that map to a canonical board slug.
 * Used to unify synonymous topic names (finance/stocks/investing → markets).
 */
const SYNONYMS: Record<string, string> = {
  // Markets / finance
  stock: 'markets', stocks: 'markets', investing: 'markets',
  investment: 'markets', investments: 'markets', finance: 'markets',
  financial: 'markets', trading: 'markets', trader: 'markets',
  forex: 'markets', economy: 'markets', economics: 'markets',
  // Technology
  tech: 'technology', coding: 'technology', programming: 'technology',
  software: 'technology', developer: 'technology', developers: 'technology',
  engineering: 'technology', ai: 'technology', 'artificial-intelligence': 'technology',
  ml: 'technology', 'machine-learning': 'technology',
  // World Chain / crypto
  crypto: 'worldchain', cryptocurrency: 'worldchain', blockchain: 'worldchain',
  bitcoin: 'worldchain', ethereum: 'worldchain', defi: 'worldchain',
  nft: 'worldchain', web3: 'worldchain',
  // Politics
  political: 'politics', government: 'politics', policy: 'politics', elections: 'politics',
  // General
  general: 'arkora', news: 'arkora', random: 'arkora',
  // Confessions
  confession: 'confessions', anonymous: 'confessions',
}

/**
 * Normalizes any user input into a URL-safe board slug.
 * - Lowercase, trim
 * - Replace spaces/underscores with hyphens
 * - Remove non-alphanumeric except hyphens
 * - Collapse repeated hyphens, strip leading/trailing
 * - Cap at 30 characters
 */
export function normalizeBoard(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30) || 'arkora'
}

/** Levenshtein distance (edit distance) between two strings. */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] = a[i - 1] === b[j - 1]
        ? dp[i - 1]![j - 1]!
        : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!)
    }
  }
  return dp[m]![n]!
}

/**
 * Resolves a user-supplied board name to a canonical board slug.
 *
 * Resolution order:
 * 1. Normalize the input
 * 2. Check synonym dictionary
 * 3. Check exact match against existing boards
 * 4. Check Levenshtein distance ≤ 2 against existing boards (typo tolerance)
 * 5. Return the normalized slug as a new board
 *
 * @param input - Raw user input (e.g. "Investing", "stokcks", "politcs")
 * @param existingIds - Current board slugs from DB
 */
export function resolveBoard(input: string, existingIds: string[]): string {
  const slug = normalizeBoard(input)
  if (!slug) return 'arkora'

  // Synonym lookup
  if (SYNONYMS[slug]) return SYNONYMS[slug]!

  // Exact match
  if (existingIds.includes(slug)) return slug

  // Typo tolerance - find closest existing board within edit distance 2
  let best: string | null = null
  let bestDist = 3 // threshold: only match if distance ≤ 2
  for (const id of existingIds) {
    const d = levenshtein(slug, id)
    if (d < bestDist) { bestDist = d; best = id }
  }
  if (best) return best

  // New board - return normalized slug
  return slug
}

/** Derives a human-readable display label from a board slug. */
export function boardLabel(id: string): string {
  const featured = FEATURED_BOARDS.find((b) => b.id === id)
  if (featured) return featured.label
  // Title-case the slug: "world-news" → "World News"
  return id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
