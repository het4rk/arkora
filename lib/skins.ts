export type SkinId =
  | 'monochrome'
  | 'red'
  | 'blue'
  | 'navy'
  | 'indigo'
  | 'purple'
  | 'teal'
  | 'green'
  | 'amber'
  | 'rose'
  | 'hex'

export interface Skin {
  id: SkinId
  label: string
  priceWld: number // 0 = free, 1 = standard, 5 = premium
  rgb: string // CSS RGB triplet e.g. "239 68 68"
  hex: string // e.g. "#EF4444"
  hover: string // hover shade hex
}

/**
 * Skin catalog. Monochrome is free (theme-aware, handled by globals.css defaults).
 * Standard skins: 1 WLD. Hex unlock: 5 WLD (user picks any color).
 */
export const SKINS: Skin[] = [
  { id: 'monochrome', label: 'Mono', priceWld: 0, rgb: '', hex: '', hover: '' },
  { id: 'red', label: 'Red', priceWld: 1, rgb: '239 68 68', hex: '#EF4444', hover: '#DC2626' },
  { id: 'blue', label: 'Blue', priceWld: 1, rgb: '59 130 246', hex: '#3B82F6', hover: '#2563EB' },
  { id: 'navy', label: 'Navy', priceWld: 1, rgb: '30 58 138', hex: '#1E3A8A', hover: '#1E40AF' },
  { id: 'indigo', label: 'Indigo', priceWld: 1, rgb: '99 102 241', hex: '#6366F1', hover: '#4F46E5' },
  { id: 'purple', label: 'Purple', priceWld: 1, rgb: '168 85 247', hex: '#A855F7', hover: '#9333EA' },
  { id: 'teal', label: 'Teal', priceWld: 1, rgb: '20 184 166', hex: '#14B8A6', hover: '#0D9488' },
  { id: 'green', label: 'Green', priceWld: 1, rgb: '34 197 94', hex: '#22C55E', hover: '#16A34A' },
  { id: 'amber', label: 'Amber', priceWld: 1, rgb: '245 158 11', hex: '#F59E0B', hover: '#D97706' },
  { id: 'rose', label: 'Rose', priceWld: 1, rgb: '244 63 94', hex: '#F43F5E', hover: '#E11D48' },
  { id: 'hex', label: 'Custom', priceWld: 5, rgb: '', hex: '', hover: '' },
]

export function getSkinById(id: SkinId): Skin | undefined {
  return SKINS.find((s) => s.id === id)
}

export function isValidSkinId(id: string): id is SkinId {
  return SKINS.some((s) => s.id === id)
}

/** Convert hex color string to CSS RGB triplet */
export function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `${r} ${g} ${b}`
}

/** Darken a hex color by a percentage (0-1) for hover states */
export function darkenHex(hex: string, amount: number = 0.15): string {
  const h = hex.replace('#', '')
  const r = Math.max(0, Math.round(parseInt(h.substring(0, 2), 16) * (1 - amount)))
  const g = Math.max(0, Math.round(parseInt(h.substring(2, 4), 16) * (1 - amount)))
  const b = Math.max(0, Math.round(parseInt(h.substring(4, 6), 16) * (1 - amount)))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}
