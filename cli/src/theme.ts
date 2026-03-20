import chalk, { type ChalkInstance } from 'chalk'

/** Skin color map - matches lib/skins.ts on the server */
const SKIN_COLORS: Record<string, string> = {
  monochrome: '#FFFFFF',
  red: '#EF4444',
  blue: '#3B82F6',
  navy: '#1E3A8A',
  indigo: '#6366F1',
  purple: '#A855F7',
  teal: '#14B8A6',
  green: '#22C55E',
  amber: '#F59E0B',
  rose: '#F43F5E',
}

let accentColor = '#FFFFFF'

/** Set the accent color from the user's skin preference */
export function setAccent(skinId: string, customHex?: string | null): void {
  if (skinId === 'hex' && customHex) {
    accentColor = customHex
  } else {
    accentColor = SKIN_COLORS[skinId] ?? '#FFFFFF'
  }
}

/** Returns a chalk instance using the user's accent color */
export function accent(text: string): string {
  return chalk.hex(accentColor)(text)
}

/** Bold accent */
export function accentBold(text: string): string {
  return chalk.hex(accentColor).bold(text)
}

/** Dimmed text */
export function dim(text: string): string {
  return chalk.dim(text)
}

/** Upvote color (green) */
export function up(text: string): string {
  return chalk.green(text)
}

/** Downvote color (red) */
export function down(text: string): string {
  return chalk.red(text)
}

/** Board tag */
export function board(text: string): string {
  return chalk.hex(accentColor)(`#${text}`)
}

/** Separator line */
export function separator(): string {
  return chalk.dim('─'.repeat(60))
}
