'use client'

import { useEffect, useRef } from 'react'
import { useArkoraStore } from '@/store/useArkoraStore'
import { getFontById } from '@/lib/fonts'

/**
 * Watches activeFontId from Zustand and applies the font globally.
 * - For 'system': removes --font-override so globals.css defaults apply.
 * - For Google Fonts: injects a <link> into <head> and sets --font-override.
 */
export function FontProvider() {
  const activeFontId = useArkoraStore((s) => s.activeFontId)
  const linkRef = useRef<HTMLLinkElement | null>(null)

  useEffect(() => {
    const root = document.documentElement

    if (activeFontId === 'system') {
      root.style.removeProperty('--font-override')
      if (linkRef.current) {
        linkRef.current.remove()
        linkRef.current = null
      }
      return
    }

    const font = getFontById(activeFontId)
    if (!font || !font.googleFontsUrl) return

    // Inject Google Fonts stylesheet if not already loaded
    if (linkRef.current) {
      linkRef.current.href = font.googleFontsUrl
    } else {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = font.googleFontsUrl
      document.head.appendChild(link)
      linkRef.current = link
    }

    root.style.setProperty('--font-override', font.cssFamily)
  }, [activeFontId])

  return null
}
