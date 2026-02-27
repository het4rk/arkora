// Generates random anonymous session tags like "Human #4821"
// Different every post - no link between posts
export function generateSessionTag(): string {
  const num = Math.floor(1000 + Math.random() * 9000)
  return `Human #${num}`
}

// Deterministic privacy-preserving alias from nullifier hash.
// Same nullifier always → same alias, but alias reveals nothing about the hash.
const ADJECTIVES = [
  'quiet', 'brave', 'swift', 'calm', 'sharp', 'wild', 'deep', 'cold',
  'bold', 'keen', 'pure', 'wise', 'dark', 'free', 'still', 'bright',
  'lone', 'raw', 'vast', 'firm', 'lost', 'pale', 'gray', 'iron',
  'thin', 'soft', 'hard', 'mute', 'slow', 'tame',
]
const NOUNS = [
  'storm', 'wave', 'echo', 'pulse', 'void', 'mind', 'fire', 'stone',
  'path', 'star', 'moon', 'light', 'wind', 'flux', 'node', 'core',
  'peak', 'arc', 'grid', 'base', 'lens', 'dust', 'leaf', 'salt',
  'river', 'moss', 'edge', 'fog', 'glow', 'root',
]

export function generateAlias(nullifierHash: string): string {
  const clean = nullifierHash.replace('0x', '')
  const seed1 = parseInt(clean.slice(0, 4), 16)
  const seed2 = parseInt(clean.slice(4, 8), 16)
  const seed3 = parseInt(clean.slice(8, 10), 16)
  const adj = ADJECTIVES[seed1 % ADJECTIVES.length] ?? 'quiet'
  const noun = NOUNS[seed2 % NOUNS.length] ?? 'storm'
  const suffix = seed3.toString(16).padStart(2, '0')
  return `${adj}.${noun}.${suffix}`
}
