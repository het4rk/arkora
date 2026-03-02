'use client'

import { useEffect } from 'react'
import { useArkoraStore } from '@/store/useArkoraStore'
import { detectLocale } from '@/lib/i18n'

/**
 * Mounted once in the root layout. Two responsibilities:
 * 1. Auto-detect browser locale on first visit (only if locale is default 'en')
 * 2. Keep <html lang> in sync with the active locale for accessibility
 */
export function LocaleDetector() {
  const locale = useArkoraStore((s) => s.locale)
  const setLocale = useArkoraStore((s) => s.setLocale)

  // Auto-detect on first visit only
  useEffect(() => {
    if (locale === 'en') {
      const detected = detectLocale()
      if (detected !== 'en') setLocale(detected)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep <html lang> attribute in sync for screen readers and search engines
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  return null
}
