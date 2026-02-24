'use client'

import { useState } from 'react'
import { sendWld } from '@/hooks/useTip'
import { useArkoraStore } from '@/store/useArkoraStore'
import { haptic } from '@/lib/utils'

interface Props {
  recipientHash: string
  recipientName: string
  onClose: () => void
}

const AMOUNTS = [0.1, 0.5, 1, 5]

type State = 'pick' | 'sending' | 'success' | 'error'

export function TipModal({ recipientHash, recipientName, onClose }: Props) {
  const { nullifierHash, isVerified, setVerifySheetOpen } = useArkoraStore()
  const [selected, setSelected] = useState<number>(1)
  const [custom, setCustom] = useState('')
  const [state, setState] = useState<State>('pick')
  const [errorMsg, setErrorMsg] = useState('')

  const amount = custom ? parseFloat(custom) : selected
  const amountValid = !isNaN(amount) && amount > 0 && amount <= 1000

  async function handleSend() {
    if (!isVerified || !nullifierHash) { setVerifySheetOpen(true); return }
    if (!amountValid) return
    haptic('medium')
    setState('sending')
    setErrorMsg('')

    try {
      // Fetch recipient wallet via profile API
      const profileRes = await fetch(`/api/u/${encodeURIComponent(recipientHash)}`)
      const profileJson = (await profileRes.json()) as { success: boolean; data?: { user?: { walletAddress: string } } }
      const wallet = profileJson.data?.user?.walletAddress
      if (!wallet) throw new Error('Could not find recipient wallet')

      const txId = await sendWld(wallet, amount)
      // Record tip in DB (fire-and-forget — tx may be pending)
      await fetch('/api/tip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderHash: nullifierHash, recipientHash, amountWld: amount.toString(), txId }),
      })
      haptic('heavy')
      setState('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Transaction failed')
      setState('error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full max-w-md glass rounded-t-[28px] px-6 pt-5 pb-[max(env(safe-area-inset-bottom),24px)] space-y-5">
        {/* Handle */}
        <div className="w-10 h-1 bg-border rounded-full mx-auto" />

        {state === 'success' ? (
          <div className="text-center space-y-3 py-4">
            <p className="text-4xl">🎉</p>
            <p className="font-bold text-text text-lg">Sent!</p>
            <p className="text-text-secondary text-sm">{amount} WLD sent to {recipientName}</p>
            <button
              onClick={onClose}
              className="mt-2 px-6 py-2.5 bg-accent text-white rounded-[var(--r-full)] font-semibold active:scale-95 transition-all"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div>
              <p className="font-bold text-text text-lg">Tip {recipientName}</p>
              <p className="text-text-muted text-xs mt-0.5">WLD sent directly onchain</p>
            </div>

            {/* Amount chips */}
            <div className="flex gap-2 flex-wrap">
              {AMOUNTS.map((a) => (
                <button
                  key={a}
                  onClick={() => { setCustom(''); setSelected(a) }}
                  className={`px-4 py-2 rounded-[var(--r-full)] text-sm font-semibold transition-all ${
                    !custom && selected === a
                      ? 'bg-accent text-white shadow-sm shadow-accent/30'
                      : 'glass border border-border text-text-muted'
                  }`}
                >
                  {a} WLD
                </button>
              ))}
            </div>

            {/* Custom amount */}
            <div className="relative">
              <input
                type="number"
                placeholder="Custom amount"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                min="0.01"
                max="1000"
                step="0.01"
                className="glass-input w-full rounded-[var(--r-md)] px-3 py-2.5 text-sm pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs font-medium">WLD</span>
            </div>

            {state === 'error' && (
              <p className="text-downvote text-xs">{errorMsg || 'Transaction failed. Try again.'}</p>
            )}

            <button
              onClick={() => void handleSend()}
              disabled={state === 'sending' || !amountValid}
              className="w-full py-3 bg-accent text-white rounded-[var(--r-full)] font-semibold text-sm active:scale-[0.98] transition-all disabled:opacity-40"
            >
              {state === 'sending' ? 'Confirming in World App…' : `Send ${amountValid ? amount : ''} WLD`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
