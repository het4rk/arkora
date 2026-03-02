'use client'

import { useState, useCallback } from 'react'
import { useArkoraStore } from '@/store/useArkoraStore'
import { SKINS, type SkinId } from '@/lib/skins'
import { sendWld } from '@/hooks/useTip'
import { MiniKit } from '@worldcoin/minikit-js'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { cn } from '@/lib/utils'
import { useT } from '@/hooks/useT'

const TREASURY_WALLET = process.env.NEXT_PUBLIC_TREASURY_WALLET ?? ''

export function SkinShop() {
  const t = useT()
  const {
    activeSkinId, customHex, ownedSkins,
    setActiveSkin, setOwnedSkins,
  } = useArkoraStore()

  const [purchasing, setPurchasing] = useState<SkinId | null>(null)
  const [confirmSkin, setConfirmSkin] = useState<SkinId | null>(null)
  const [hexInput, setHexInput] = useState(customHex ?? '#6366F1')
  const [error, setError] = useState<string | null>(null)
  // Stores the skin to revert to if the user cancels or payment fails
  const [previewPrev, setPreviewPrev] = useState<{ skinId: SkinId; hex: string | undefined } | null>(null)

  const isMiniKit = typeof window !== 'undefined' && MiniKit.isInstalled()
  const isOwned = (id: SkinId) => id === 'monochrome' || ownedSkins.includes(id)

  const handleTap = useCallback((skinId: SkinId) => {
    if (isOwned(skinId)) {
      // Activate immediately + persist to server
      const hex = skinId === 'hex' ? hexInput : undefined
      setActiveSkin(skinId, hex)
      void fetch('/api/skins/activate', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skinId, customHex: hex }),
      })
    } else {
      // Preview: apply skin immediately so the user sees it behind the payment sheet
      setPreviewPrev({ skinId: activeSkinId, hex: customHex ?? undefined })
      const hex = skinId === 'hex' ? hexInput : undefined
      setActiveSkin(skinId, hex)
      setConfirmSkin(skinId)
      setError(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownedSkins, hexInput, activeSkinId, customHex])

  const revertPreview = useCallback(() => {
    if (previewPrev) {
      setActiveSkin(previewPrev.skinId, previewPrev.hex)
      setPreviewPrev(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewPrev])

  const handlePurchase = useCallback(async () => {
    if (!confirmSkin) return
    const skin = SKINS.find((s) => s.id === confirmSkin)
    if (!skin) return

    if (!TREASURY_WALLET) {
      setError('Treasury wallet not configured')
      return
    }

    setPurchasing(confirmSkin)
    setError(null)

    const result = await sendWld(TREASURY_WALLET, skin.priceWld, `Unlock ${skin.label} skin`)
    if (!result) {
      setError('Transaction cancelled or failed')
      revertPreview()
      setPurchasing(null)
      return
    }

    const res = await fetch('/api/skins/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skinId: confirmSkin, txId: result.txId }),
    })

    const json = await res.json()
    if (!res.ok || !json.success) {
      setError(json.error ?? 'Purchase failed')
      revertPreview()
      setPurchasing(null)
      return
    }

    // Purchase succeeded - skin is already applied as preview, now persist
    setOwnedSkins([...ownedSkins, confirmSkin])
    setPreviewPrev(null)
    setPurchasing(null)
    setConfirmSkin(null)
    // Persist activation to server
    void fetch('/api/skins/activate', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skinId: confirmSkin, customHex: confirmSkin === 'hex' ? hexInput : undefined }),
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmSkin, ownedSkins, hexInput, revertPreview])

  const handleHexChange = useCallback((hex: string) => {
    setHexInput(hex)
    if (activeSkinId === 'hex' && /^#[0-9A-Fa-f]{6}$/.test(hex)) {
      setActiveSkin('hex', hex)
      void fetch('/api/skins/activate', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skinId: 'hex', customHex: hex }),
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSkinId])

  const confirmSkinData = confirmSkin ? SKINS.find((s) => s.id === confirmSkin) : null

  return (
    <>
      <div className="space-y-3">
        {/* Swatch grid */}
        <div className="grid grid-cols-6 gap-2">
          {SKINS.filter((s) => s.id !== 'hex').map((skin) => {
            const owned = isOwned(skin.id)
            const active = activeSkinId === skin.id
            // Monochrome swatch: show half-black/half-white
            const bgColor = skin.id === 'monochrome' ? undefined : skin.hex

            return (
              <button
                key={skin.id}
                onClick={() => handleTap(skin.id)}
                className="flex flex-col items-center gap-1.5"
              >
                <div
                  className={cn(
                    'w-9 h-9 rounded-full border-2 transition-all relative',
                    active
                      ? 'border-text scale-110'
                      : owned
                        ? 'border-border'
                        : 'border-border/50 opacity-60'
                  )}
                  style={bgColor ? { backgroundColor: bgColor } : undefined}
                >
                  {/* Monochrome: gradient swatch */}
                  {skin.id === 'monochrome' && (
                    <div className="absolute inset-0.5 rounded-full overflow-hidden">
                      <div className="absolute inset-0 left-0 right-1/2 bg-black" />
                      <div className="absolute inset-0 left-1/2 bg-white" />
                    </div>
                  )}
                  {/* Lock icon for unowned */}
                  {!owned && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-md">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </div>
                  )}
                </div>
                <span className={cn(
                  'text-[10px]',
                  active ? 'text-text font-semibold' : 'text-text-muted'
                )}>
                  {skin.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Hex unlock row */}
        {(() => {
          const hexSkin = SKINS.find((s) => s.id === 'hex')!
          const hexOwned = isOwned('hex')
          const hexActive = activeSkinId === 'hex'

          return (
            <div className="glass rounded-[var(--r-lg)] p-3 space-y-2">
              <button
                onClick={() => handleTap('hex')}
                className="w-full flex items-center gap-3"
              >
                <div
                  className={cn(
                    'w-9 h-9 rounded-full border-2 transition-all flex-shrink-0',
                    hexActive ? 'border-text' : hexOwned ? 'border-border' : 'border-border/50',
                    hexOwned
                      ? 'bg-[conic-gradient(#EF4444,#F59E0B,#22C55E,#3B82F6,#A855F7,#EF4444)]'
                      : 'bg-border/30'
                  )}
                >
                  {!hexOwned && (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="text-left flex-1">
                  <p className="text-text text-sm font-semibold">
                    {t('shop.customColor')}
                  </p>
                  <p className="text-text-muted text-xs">
                    {hexOwned ? t('shop.pickAnyColor') : `${hexSkin.priceWld} WLD - ${t('shop.unlockAnyColor')}`}
                  </p>
                </div>
                {hexOwned && hexActive && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>

              {/* Color picker - only when hex is owned and active */}
              {hexOwned && hexActive && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="color"
                    value={hexInput}
                    onChange={(e) => handleHexChange(e.target.value)}
                    aria-label="Accent color picker"
                    className="w-8 h-8 rounded-lg border-0 cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={hexInput}
                    onChange={(e) => handleHexChange(e.target.value)}
                    placeholder="#6366F1"
                    aria-label="Hex color value"
                    maxLength={7}
                    className="glass-input flex-1 text-sm font-mono px-3 py-2 rounded-lg"
                  />
                </div>
              )}
            </div>
          )
        })()}
      </div>

      {/* Purchase confirmation sheet */}
      <BottomSheet
        isOpen={!!confirmSkin}
        onClose={() => { revertPreview(); setConfirmSkin(null); setError(null) }}
        title={t('shop.unlockSkin')}
      >
        {confirmSkinData && (
          <div className="flex flex-col items-center text-center gap-5 py-4">
            <div
              className={cn(
                'w-16 h-16 rounded-full border-2 border-border',
                confirmSkinData.id === 'hex'
                  ? 'bg-[conic-gradient(#EF4444,#F59E0B,#22C55E,#3B82F6,#A855F7,#EF4444)]'
                  : ''
              )}
              style={confirmSkinData.id !== 'hex' ? { backgroundColor: confirmSkinData.hex } : undefined}
            />
            <div>
              <p className="text-text font-bold text-lg">
                Unlock {confirmSkinData.label}
              </p>
              <p className="text-text-secondary text-sm mt-1">
                {confirmSkinData.priceWld} WLD - {t('shop.permanent')}
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
                {purchasing ? t('shop.confirming') : `${t('shop.pay')} ${confirmSkinData.priceWld} WLD`}
              </button>
            ) : (
              <div className="w-full glass rounded-2xl py-4 text-center">
                <p className="text-text-muted text-sm">
                  {t('shop.purchaseInApp')}
                </p>
                <p className="text-text-muted/60 text-xs mt-1">
                  {t('shop.openInWorldApp')}
                </p>
              </div>
            )}
          </div>
        )}
      </BottomSheet>
    </>
  )
}
