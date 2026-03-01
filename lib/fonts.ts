export type FontId =
  | 'system'
  | 'inter'
  | 'dm-sans'
  | 'space-grotesk'
  | 'jetbrains-mono'
  | 'playfair'
  | 'instrument-serif'

export interface Font {
  id: FontId
  label: string
  priceWld: number // 0 = free (system default)
  cssFamily: string // CSS font-family value, empty for system
  googleFontsUrl: string | null // null for system font
  sampleText: string // preview text in FontShop
}

export const FONTS: Font[] = [
  { id: 'system', label: 'System', priceWld: 0, cssFamily: '', googleFontsUrl: null, sampleText: 'Default system font' },
  { id: 'inter', label: 'Inter', priceWld: 1, cssFamily: "'Inter', sans-serif", googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap', sampleText: 'Clean and modern' },
  { id: 'dm-sans', label: 'DM Sans', priceWld: 1, cssFamily: "'DM Sans', sans-serif", googleFontsUrl: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap', sampleText: 'Warm and friendly' },
  { id: 'space-grotesk', label: 'Space Grotesk', priceWld: 1, cssFamily: "'Space Grotesk', sans-serif", googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap', sampleText: 'Bold geometric type' },
  { id: 'jetbrains-mono', label: 'JetBrains Mono', priceWld: 1, cssFamily: "'JetBrains Mono', monospace", googleFontsUrl: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap', sampleText: 'Code-inspired clarity' },
  { id: 'playfair', label: 'Playfair', priceWld: 1, cssFamily: "'Playfair Display', serif", googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap', sampleText: 'Elegant serif style' },
  { id: 'instrument-serif', label: 'Instrument Serif', priceWld: 1, cssFamily: "'Instrument Serif', serif", googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Instrument+Serif&display=swap', sampleText: 'Refined and classic' },
]

export function getFontById(id: FontId): Font | undefined {
  return FONTS.find((f) => f.id === id)
}

export function isValidFontId(id: string): id is FontId {
  return FONTS.some((f) => f.id === id)
}
