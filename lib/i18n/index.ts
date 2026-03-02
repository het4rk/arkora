import en, { type Dict, type TKey } from './en'

/**
 * Single source of truth for supported locales.
 * Adding a new locale: add the code here, create lib/i18n/<code>.ts,
 * add an entry to `dictionaries` below, and add a label to LOCALE_LABELS.
 * The Locale type and language picker derive from this array automatically.
 */
export const LOCALES = ['en', 'es', 'pt', 'fr', 'de', 'ja', 'ko', 'th', 'id', 'tr'] as const
export type Locale = (typeof LOCALES)[number]

/** Native-language labels for the language picker UI. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  es: 'Espanol',
  pt: 'Portugues',
  fr: 'Francais',
  de: 'Deutsch',
  ja: '\u65E5\u672C\u8A9E',
  ko: '\uD55C\uAD6D\uC5B4',
  th: '\u0E44\u0E17\u0E22',
  id: 'Bahasa Indonesia',
  tr: 'Turkce',
}

const dictionaries: Record<Locale, () => Promise<Dict>> = {
  en: () => Promise.resolve(en),
  es: () => import('./es').then((m) => m.default),
  pt: () => import('./pt').then((m) => m.default),
  fr: () => import('./fr').then((m) => m.default),
  de: () => import('./de').then((m) => m.default),
  ja: () => import('./ja').then((m) => m.default),
  ko: () => import('./ko').then((m) => m.default),
  th: () => import('./th').then((m) => m.default),
  id: () => import('./id').then((m) => m.default),
  tr: () => import('./tr').then((m) => m.default),
}

// Cache loaded dictionaries so we only import once per locale
const cache = new Map<Locale, Dict>()
cache.set('en', en)

export async function loadDictionary(locale: Locale): Promise<Dict> {
  const cached = cache.get(locale)
  if (cached) return cached
  const dict = await dictionaries[locale]()
  cache.set(locale, dict)
  return dict
}

/** Synchronous translate - falls back to English if key missing from loaded dict. */
export function translate(dict: Dict, key: TKey): string {
  return dict[key] ?? en[key]
}

/** Detect locale from navigator.language, returning a supported Locale. */
export function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en'
  const lang = navigator.language.toLowerCase()
  for (const l of LOCALES) {
    if (lang === l || lang.startsWith(`${l}-`)) return l
  }
  return 'en'
}

export type { TKey, Dict }
