// Generates anonymous session tags like "Human #4821"
// Random per-session — not tied to nullifier hash for privacy
export function generateSessionTag(): string {
  const num = Math.floor(1000 + Math.random() * 9000) // 1000–9999
  return `Human #${num}`
}
