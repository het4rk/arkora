'use client'

import { useState, useCallback, useEffect } from 'react'
import { useArkoraStore } from '@/store/useArkoraStore'
import { FONTS, type FontId } from '@/lib/fonts'
import { sendWld } from '@/hooks/useTip'
import { MiniKit } from '@worldcoin/minikit-js'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { cn } from '@/lib/utils'

const TREASURY_WALLET = process.env.NEXT_PUBLIC_TREASURY_WALLET ?? ''

export function FontShop() {
  const {
    activeFontId, ownedFonts,
    setActiveFont, setOwnedFonts,
  } = useArkoraStore()

  const [purchasing, setPurchasing] = useState<FontId | null>(null)
  const [confirmFont, setConfirmFont] = useState<FontId | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Track which Google Fonts stylesheets are loaded for previews
  const [loadedFonts, setLoadedFonts] = useState<Set<string>>(new Set())

  const isMiniKit = typeof window !== 'undefined' && MiniKit.isInstalled()
  const isOwned = (id: FontId) => id === 'system' || ownedFonts.includes(id)

  // Preload all Google Fonts for preview rendering
  useEffect(() => {
    FONTS.forEach((font) => {
      if (font.googleFontsUrl && !loadedFonts.has(font.id)) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = font.googleFontsUrl
        document.head.appendChild(link)
        setLoadedFonts((prev) => new Set(prev).add(font.id))
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleTap = useCallback((fontId: FontId) => {
    if (isOwned(fontId)) {
      setActiveFont(fontId)
      void fetch('/api/fonts/activate', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fontId }),
      })
    } else {
      setConfirmFont(fontId)
      setError(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownedFonts])

  const handlePurchase = useCallback(async () => {
    if (!confirmFont) return
    const font = FONTS.find((f) => f.id === confirmFont)
    if (!font) return

    if (!TREASURY_WALLET) {
      setError('Treasury wallet not configured')
      return
    }

    setPurchasing(confirmFont)
    setError(null)

    const result = await sendWld(TREASURY_WALLET, font.priceWld, `Unlock ${font.label} font`)
    if (!result) {
      setError('Transaction cancelled or failed')
      setPurchasing(null)
      return
    }

    const res = await fetch('/api/fonts/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fontId: confirmFont, txId: result.txId }),
    })

    const json = await res.json()
    if (!res.ok || !json.success) {
      setError(json.error ?? 'Purchase failed')
      setPurchasing(null)
      return
    }

    setOwnedFonts([...ownedFonts, confirmFont])
    setActiveFont(confirmFont)
    setPurchasing(null)
    setConfirmFont(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmFont, ownedFonts])

  const confirmFontData = confirmFont ? FONTS.find((f) => f.id === confirmFont) : null

  return (
    <>
      <section className="space-y-3">
        <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.12em]">
          Font
        </p>

        <div className="space-y-2">
          {FONTS.map((font) => {
            const owned = isOwned(font.id)
            const active = activeFontId === font.id

            return (
              <button
                key={font.id}
                onClick={() => handleTap(font.id)}
                className={cn(
                  'w-full glass rounded-[var(--r-lg)] p-3.5 flex items-center gap-3 text-left transition-all',
                  active && 'ring-1 ring-accent/40'
                )}
              >
                {/* Font preview */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-text text-[15px] font-semibold truncate"
                    style={font.cssFamily ? { fontFamily: font.cssFamily } : undefined}
                  >
                    {font.label}
                  </p>
                  <p
                    className="text-text-muted text-xs mt-0.5 truncate"
                    style={font.cssFamily ? { fontFamily: font.cssFamily } : undefined}
                  >
                    {font.sampleText}
                  </p>
                </div>

                {/* Status indicator */}
                {active ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent flex-shrink-0">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : !owned ? (
                  <span className="text-text-muted text-xs font-medium flex-shrink-0 glass rounded-full px-2.5 py-1">
                    {font.priceWld} WLD
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </section>

      {/* Purchase confirmation sheet */}
      <BottomSheet
        isOpen={!!confirmFont}
        onClose={() => { setConfirmFont(null); setError(null) }}
        title="Unlock Font"
      >
        {confirmFontData && (
          <div className="flex flex-col items-center text-center gap-5 py-4">
            <div className="glass rounded-[var(--r-xl)] px-6 py-4 w-full">
              <p
                className="text-text text-xl font-semibold"
                style={confirmFontData.cssFamily ? { fontFamily: confirmFontData.cssFamily } : undefined}
              >
                {confirmFontData.label}
              </p>
              <p
                className="text-text-muted text-sm mt-1"
                style={confirmFontData.cssFamily ? { fontFamily: confirmFontData.cssFamily } : undefined}
              >
                {confirmFontData.sampleText}
              </p>
            </div>
            <div>
              <p className="text-text font-bold text-lg">
                Unlock {confirmFontData.label}
              </p>
              <p className="text-text-secondary text-sm mt-1">
                {confirmFontData.priceWld} WLD - permanent, synced across devices
              </p>
            </div>

            {error && (
              <p className="text-text-secondary text-sm bg-surface-up rounded-xl px-4 py-2 w-full">
                {error}
              </p>
            )}

            {isMiniKit ? (
              <button
                onClick={() => void handlePurchase()}
                disabled={!!purchasing}
                className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-background font-bold py-4 rounded-2xl transition-colors active:scale-95 text-base"
              >
                {purchasing ? 'Confirming...' : `Pay ${confirmFontData.priceWld} WLD`}
              </button>
            ) : (
              <div className="w-full glass rounded-2xl py-4 text-center">
                <p className="text-text-muted text-sm">
                  Purchase in World App
                </p>
                <p className="text-text-muted/60 text-xs mt-1">
                  Open Arkora in World App to buy fonts
                </p>
              </div>
            )}
          </div>
        )}
      </BottomSheet>
    </>
  )
}
