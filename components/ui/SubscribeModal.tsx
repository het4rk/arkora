'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { sendWld } from '@/hooks/useTip'
import { useArkoraStore } from '@/store/useArkoraStore'
import { haptic } from '@/lib/utils'

interface Props {
  creatorHash: string
  creatorName: string
  creatorWallet: string
  isSubscribed: boolean
  daysLeft: number | null
  onClose: () => void
  onSubscribed: (daysLeft: number) => void
  onCancelled: () => void
}

const PRICE_WLD = 1

type View = 'main' | 'cancel-confirm' | 'success' | 'renewed' | 'cancelled' | 'error'

export function SubscribeModal({
  creatorHash,
  creatorName,
  creatorWallet,
  isSubscribed,
  daysLeft,
  onClose,
  onSubscribed,
  onCancelled,
}: Props) {
  const { nullifierHash, isVerified, setVerifySheetOpen } = useArkoraStore()
  const [view, setView] = useState<View>('main')
  const [loading, setLoading] = useState(false)
  const [loadingLabel, setLoadingLabel] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubscribe() {
    if (!isVerified || !nullifierHash) {
      setVerifySheetOpen(true)
      return
    }
    haptic('medium')
    setLoading(true)
    setLoadingLabel('Confirming in World App…')
    setErrorMsg('')
    try {
      const txId = await sendWld(creatorWallet, PRICE_WLD)
      setLoadingLabel('Recording subscription…')
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorHash,
          amountWld: String(PRICE_WLD),
          txId,
        }),
      })
      const json = (await res.json()) as {
        success: boolean
        data?: { daysLeft: number }
        error?: string
      }
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Subscription failed')
      haptic('heavy')
      onSubscribed(json.data?.daysLeft ?? 30)
      setView(isSubscribed ? 'renewed' : 'success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Transaction failed. Try again.')
      setView('error')
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel() {
    if (!nullifierHash) return
    haptic('medium')
    setLoading(true)
    setLoadingLabel('Cancelling…')
    try {
      const res = await fetch('/api/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorHash }),
      })
      const json = (await res.json()) as { success: boolean }
      if (!json.success) throw new Error('Failed to cancel')
      haptic('medium')
      onCancelled()
      setView('cancelled')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to cancel subscription.')
      setView('error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={loading ? undefined : onClose}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 300 }}
        className="relative w-full max-w-md glass rounded-t-[28px] px-6 pt-5 pb-[max(env(safe-area-inset-bottom),24px)] space-y-5"
      >
        {/* Handle bar */}
        <div className="w-10 h-1 bg-border rounded-full mx-auto" />

        {/* ── Success (new subscription) ─────────────────────────── */}
        {view === 'success' && (
          <div className="text-center space-y-3 py-4">
            <div className="w-16 h-16 rounded-full bg-surface-up flex items-center justify-center mx-auto">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
            </div>
            <p className="font-bold text-text text-xl">Subscribed!</p>
            <p className="text-text-secondary text-sm">Supporting {creatorName} for 30 days</p>
            <button
              onClick={onClose}
              className="mt-2 px-8 py-3 bg-accent text-background rounded-[var(--r-full)] font-semibold active:scale-95 transition-all"
            >
              Done
            </button>
          </div>
        )}

        {/* ── Success (renewal) ──────────────────────────────────── */}
        {view === 'renewed' && (
          <div className="text-center space-y-3 py-4">
            <div className="w-16 h-16 rounded-full bg-surface-up flex items-center justify-center mx-auto">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
            </div>
            <p className="font-bold text-text text-xl">Renewed!</p>
            <p className="text-text-secondary text-sm">Subscription extended by 30 days</p>
            <button
              onClick={onClose}
              className="mt-2 px-8 py-3 bg-accent text-background rounded-[var(--r-full)] font-semibold active:scale-95 transition-all"
            >
              Done
            </button>
          </div>
        )}

        {/* ── Cancelled ──────────────────────────────────────────── */}
        {view === 'cancelled' && (
          <div className="text-center space-y-3 py-4">
            <p className="font-bold text-text text-xl">Subscription cancelled</p>
            <p className="text-text-secondary text-sm">Unsubscribed from {creatorName}</p>
            <button
              onClick={onClose}
              className="mt-2 px-8 py-3 glass border border-border text-text-muted rounded-[var(--r-full)] font-semibold active:scale-95 transition-all"
            >
              Close
            </button>
          </div>
        )}

        {/* ── Error ──────────────────────────────────────────────── */}
        {view === 'error' && (
          <div className="space-y-5">
            <div className="text-center py-2">
              <p className="font-bold text-text text-xl mb-1.5">Something went wrong</p>
              <p className="text-text-secondary text-sm leading-relaxed">{errorMsg}</p>
            </div>
            <button
              onClick={() => setView('main')}
              className="w-full py-3 glass border border-border text-text-muted rounded-[var(--r-full)] font-semibold text-sm active:scale-[0.98] transition-all"
            >
              Try again
            </button>
          </div>
        )}

        {/* ── Cancel confirmation ────────────────────────────────── */}
        {view === 'cancel-confirm' && (
          <div className="space-y-5">
            <div>
              <p className="font-bold text-text text-xl">Cancel subscription?</p>
              <p className="text-text-secondary text-sm mt-1.5 leading-relaxed">
                Access to {creatorName} remains active for{' '}
                <span className="text-text font-semibold">{daysLeft ?? '?'} more days</span>, then
                expires.
              </p>
            </div>
            <button
              onClick={() => void handleCancel()}
              disabled={loading}
              className="w-full py-3 bg-surface-up text-text-muted rounded-[var(--r-full)] font-semibold text-sm active:scale-[0.98] transition-all disabled:opacity-40"
            >
              {loading ? loadingLabel : 'Confirm cancel'}
            </button>
            <button
              onClick={() => setView('main')}
              disabled={loading}
              className="w-full py-2 text-text-muted text-sm font-medium active:opacity-60 transition-opacity disabled:opacity-40"
            >
              Keep subscription
            </button>
          </div>
        )}

        {/* ── Manage existing subscription ──────────────────────── */}
        {view === 'main' && isSubscribed && (
          <div className="space-y-5">
            <div>
              <div className="w-12 h-12 rounded-full bg-surface-up flex items-center justify-center mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
              </div>
              <p className="font-bold text-text text-xl">Subscribed to {creatorName}</p>
              <p className="text-text-secondary text-sm mt-0.5 font-medium">
                {daysLeft ?? '?'} days remaining
              </p>
            </div>

            <div className="glass rounded-[var(--r-lg)] px-4 divide-y divide-white/[0.06]">
              <div className="flex items-center justify-between py-3 text-sm">
                <span className="text-text-muted">Monthly price</span>
                <span className="text-text font-semibold">1 WLD</span>
              </div>
              <div className="flex items-center justify-between py-3 text-sm">
                <span className="text-text-muted">Status</span>
                <span className="text-[11px] font-semibold text-accent px-2.5 py-1 bg-accent/10 rounded-full">
                  Active
                </span>
              </div>
            </div>

            <button
              onClick={() => void handleSubscribe()}
              disabled={loading}
              className="w-full py-3 bg-accent text-background rounded-[var(--r-full)] font-semibold text-sm active:scale-[0.98] transition-all disabled:opacity-40"
            >
              {loading ? loadingLabel : 'Renew · 1 WLD'}
            </button>
            <button
              onClick={() => setView('cancel-confirm')}
              disabled={loading}
              className="w-full py-2 text-text-muted text-sm font-medium active:opacity-60 transition-opacity disabled:opacity-40"
            >
              Cancel subscription
            </button>
          </div>
        )}

        {/* ── New subscription ──────────────────────────────────── */}
        {view === 'main' && !isSubscribed && (
          <div className="space-y-5">
            <div>
              <div className="w-12 h-12 rounded-full bg-surface-up flex items-center justify-center mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
              </div>
              <p className="font-bold text-text text-xl">Subscribe to {creatorName}</p>
              <p className="text-text-muted text-xs mt-0.5">WLD sent directly to creator</p>
            </div>

            <div className="glass rounded-[var(--r-lg)] px-4 py-3.5 space-y-3">
              {[
                '30 days of subscriber status',
                '1 WLD sent directly onchain to creator',
                'Manual renewal — cancel anytime in Settings',
              ].map((line) => (
                <div key={line} className="flex items-center gap-3 text-sm text-text-secondary">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    className="text-accent shrink-0"
                    fill="none"
                  >
                    <path
                      d="M2 7L6 11L12 3"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {line}
                </div>
              ))}
            </div>

            <button
              onClick={() => void handleSubscribe()}
              disabled={loading}
              className="w-full py-3 bg-accent text-background rounded-[var(--r-full)] font-semibold text-sm active:scale-[0.98] transition-all disabled:opacity-40"
            >
              {loading ? loadingLabel : 'Subscribe · 1 WLD/mo'}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
