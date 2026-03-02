'use client'

import { useEffect, useState, useCallback } from 'react'
import { useArkoraStore } from '@/store/useArkoraStore'
import en, { type TKey } from '@/lib/i18n/en'
import { type Dict, loadDictionary } from '@/lib/i18n'

/**
 * Returns a `t(key)` function that translates keys to the active locale.
 *
 * - English is synchronous (no flash of untranslated content)
 * - Other locales are lazy-loaded on first use, cached after that
 * - Falls back to English for any missing key in a loaded dictionary
 * - <html lang> is handled by LocaleDetector (mounted in root layout)
 */
export function useT(): (key: TKey) => string {
  const locale = useArkoraStore((s) => s.locale)
  const [dict, setDict] = useState<Dict>(en)

  useEffect(() => {
    // English is already the initial state - skip the async round-trip
    if (locale === 'en') {
      setDict(en)
      return
    }

    let cancelled = false
    void loadDictionary(locale).then((d) => {
      if (!cancelled) setDict(d)
    })
    return () => { cancelled = true }
  }, [locale])

  return useCallback((key: TKey) => dict[key] ?? en[key], [dict])
}
