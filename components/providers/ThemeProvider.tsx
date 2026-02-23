'use client'

import { useEffect } from 'react'
import { useArkoraStore } from '@/store/useArkoraStore'

/**
 * Reads the persisted `theme` from Zustand and applies it as a `data-theme`
 * attribute on <html>. Runs client-side only — safe in World App WebView.
 */
export function ThemeProvider() {
  const theme = useArkoraStore((s) => s.theme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return null
}
