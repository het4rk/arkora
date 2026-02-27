'use client'

import { useEffect } from 'react'
import { useArkoraStore } from '@/store/useArkoraStore'
import { getSkinById, hexToRgb, darkenHex } from '@/lib/skins'

/**
 * Reads the active skin from Zustand and applies CSS custom properties
 * (--accent-rgb, --accent-hex, --accent-hover) at runtime.
 *
 * When skin is 'monochrome', removes overrides so globals.css theme-aware
 * defaults take effect (white on dark, near-black on light).
 */
export function SkinProvider() {
  const activeSkinId = useArkoraStore((s) => s.activeSkinId)
  const customHex = useArkoraStore((s) => s.customHex)

  useEffect(() => {
    const root = document.documentElement

    if (activeSkinId === 'monochrome') {
      // Remove overrides — let globals.css theme-aware defaults work
      root.style.removeProperty('--accent-rgb')
      root.style.removeProperty('--accent-hex')
      root.style.removeProperty('--accent-hover')
      return
    }

    if (activeSkinId === 'hex' && customHex) {
      const rgb = hexToRgb(customHex)
      const hover = darkenHex(customHex)
      root.style.setProperty('--accent-rgb', rgb)
      root.style.setProperty('--accent-hex', customHex)
      root.style.setProperty('--accent-hover', hover)
      return
    }

    const skin = getSkinById(activeSkinId)
    if (skin && skin.rgb) {
      root.style.setProperty('--accent-rgb', skin.rgb)
      root.style.setProperty('--accent-hex', skin.hex)
      root.style.setProperty('--accent-hover', skin.hover)
    }
  }, [activeSkinId, customHex])

  return null
}
