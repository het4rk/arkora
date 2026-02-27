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
  // Core Arkora
  { id: 'arkora',             label: 'Arkora' },
  { id: 'worldchain',         label: 'World Chain' },
  { id: 'world-app',          label: 'World App' },
  { id: 'confessions',        label: 'Confessions' },
  // News & Discussion
  { id: 'news',               label: 'News' },
  { id: 'politics',           label: 'Politics' },
  { id: 'debate',             label: 'Debate' },
  { id: 'philosophy',         label: 'Philosophy' },
  { id: 'history',            label: 'History' },
  // Tech
  { id: 'technology',         label: 'Technology' },
  { id: 'ai',                 label: 'AI' },
  { id: 'startups',           label: 'Startups' },
  { id: 'gaming',             label: 'Gaming' },
  // Finance & Crypto
  { id: 'markets',            label: 'Markets' },
  { id: 'crypto',             label: 'Crypto' },
  // Entertainment
  { id: 'sports',             label: 'Sports' },
  { id: 'music',              label: 'Music' },
  { id: 'movies',             label: 'Movies' },
  { id: 'tv',                 label: 'TV Shows' },
  { id: 'anime',              label: 'Anime' },
  { id: 'books',              label: 'Books' },
  { id: 'art',                label: 'Art' },
  // Lifestyle
  { id: 'fitness',            label: 'Fitness' },
  { id: 'food',               label: 'Food' },
  { id: 'travel',             label: 'Travel' },
  { id: 'fashion',            label: 'Fashion' },
  { id: 'relationships',      label: 'Relationships' },
  { id: 'mental-health',      label: 'Mental Health' },
  { id: 'pets',               label: 'Pets' },
  // Science & Knowledge
  { id: 'science',            label: 'Science' },
  { id: 'space',              label: 'Space' },
  { id: 'health',             label: 'Health' },
  { id: 'environment',        label: 'Environment' },
  { id: 'education',          label: 'Education' },
  // Community
  { id: 'humor',              label: 'Humor' },
  { id: 'ask',                label: 'Ask Anything' },
  { id: 'stories',            label: 'Stories' },
  { id: 'unpopular-opinions', label: 'Unpopular Opinions' },
  { id: 'career',             label: 'Career' },
  { id: 'local',              label: 'Local' },
]

/**
 * Terms that map to a canonical board slug.
 * Used to unify synonymous topic names.
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
  engineering: 'technology', dev: 'technology',
  // AI (separate board)
  'artificial-intelligence': 'ai', ml: 'ai', 'machine-learning': 'ai',
  chatgpt: 'ai', llm: 'ai', gpt: 'ai', openai: 'ai',
  // Crypto (separate from worldchain)
  cryptocurrency: 'crypto', bitcoin: 'crypto', ethereum: 'crypto',
  defi: 'crypto', nft: 'crypto', web3: 'crypto', btc: 'crypto', eth: 'crypto',
  nfts: 'crypto', solana: 'crypto', sol: 'crypto',
  // World Chain / World App
  worldcoin: 'worldchain', wld: 'worldchain', worldid: 'worldchain',
  blockchain: 'worldchain',
  miniapp: 'world-app', minikit: 'world-app', worldapp: 'world-app',
  // Politics
  political: 'politics', government: 'politics', policy: 'politics',
  election: 'politics', elections: 'politics', voting: 'politics',
  // General
  general: 'arkora', random: 'arkora', misc: 'arkora',
  // Confessions
  confession: 'confessions', anonymous: 'confessions', secrets: 'confessions',
  // Gaming
  games: 'gaming', videogames: 'gaming', esports: 'gaming',
  'video-games': 'gaming',
  // Sports
  sport: 'sports', football: 'sports', basketball: 'sports',
  soccer: 'sports', baseball: 'sports', tennis: 'sports',
  nba: 'sports', nfl: 'sports', fifa: 'sports',
  // Music
  songs: 'music', artists: 'music', albums: 'music', playlist: 'music',
  rap: 'music', hiphop: 'music', pop: 'music',
  // Movies / TV
  film: 'movies', films: 'movies', cinema: 'movies', movie: 'movies',
  television: 'tv', shows: 'tv', netflix: 'tv', streaming: 'tv',
  series: 'tv', hbo: 'tv',
  // Food
  cooking: 'food', recipes: 'food', dining: 'food', restaurant: 'food',
  restaurants: 'food',
  // Fitness
  gym: 'fitness', workout: 'fitness', exercise: 'fitness', running: 'fitness',
  lifting: 'fitness', weightlifting: 'fitness',
  // Health
  medical: 'health', medicine: 'health', wellness: 'health', diet: 'health',
  nutrition: 'health', healthcare: 'health',
  // Mental Health
  'mental-illness': 'mental-health', therapy: 'mental-health',
  anxiety: 'mental-health', depression: 'mental-health',
  // Science
  physics: 'science', chemistry: 'science', biology: 'science',
  math: 'science', mathematics: 'science',
  // Space
  nasa: 'space', astronomy: 'space', universe: 'space', stars: 'space',
  planets: 'space',
  // Environment
  climate: 'environment', sustainability: 'environment', nature: 'environment',
  'climate-change': 'environment', ecology: 'environment',
  // Art
  design: 'art', drawing: 'art', painting: 'art', photography: 'art',
  creative: 'art', illustration: 'art',
  // Humor
  memes: 'humor', funny: 'humor', jokes: 'humor', comedy: 'humor',
  // Career
  jobs: 'career', job: 'career', work: 'career', hiring: 'career',
  freelance: 'career', employment: 'career', salary: 'career',
  // Ask
  'ask-me-anything': 'ask', ama: 'ask', questions: 'ask',
  // Startups
  startup: 'startups', entrepreneurship: 'startups', entrepreneur: 'startups',
  'venture-capital': 'startups', vc: 'startups', founder: 'startups',
  // Travel
  vacation: 'travel', trip: 'travel', tourism: 'travel',
  // Relationships
  dating: 'relationships', love: 'relationships', marriage: 'relationships',
  romance: 'relationships',
  // Books
  reading: 'books', literature: 'books', novel: 'books', novels: 'books',
  // Anime
  manga: 'anime',
  // Education
  school: 'education', university: 'education', college: 'education',
  learning: 'education', studying: 'education',
  // History
  historical: 'history', ancient: 'history',
  // Pets
  dogs: 'pets', cats: 'pets', animals: 'pets',
  dog: 'pets', cat: 'pets',
  // Local
  city: 'local', community: 'local', neighborhood: 'local',
  // News
  'current-events': 'news', headlines: 'news',
  // Unpopular opinions
  'hot-takes': 'unpopular-opinions', 'hot-take': 'unpopular-opinions',
  // Debate
  opinions: 'debate', discussion: 'debate',
  // Mental health (additional)
  mindfulness: 'mental-health', selfcare: 'mental-health',
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
 * 4. Check Levenshtein distance <= 2 against existing boards (typo tolerance)
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
  let bestDist = 3 // threshold: only match if distance <= 2
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
  // Title-case the slug: "world-news" -> "World News"
  return id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
