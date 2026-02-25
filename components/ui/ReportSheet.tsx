'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { haptic } from '@/lib/utils'

const REASONS = [
  { id: 'spam', label: 'Spam', icon: '🚫' },
  { id: 'harassment', label: 'Harassment', icon: '😤' },
  { id: 'hate', label: 'Hate speech', icon: '🛑' },
  { id: 'violence', label: 'Violence', icon: '⚠️' },
  { id: 'misinformation', label: 'Misinformation', icon: '📰' },
  { id: 'other', label: 'Other', icon: '📝' },
] as const

interface Props {
  isOpen: boolean
  onClose: () => void
  targetType: 'post' | 'reply' | 'user'
  targetId: string
}

export function ReportSheet({ isOpen, onClose, targetType, targetId }: Props) {
  const [reason, setReason] = useState<string | null>(null)
  const [details, setDetails] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit() {
    if (!reason) return
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, reason, details: details.trim() || undefined }),
      })
      const json = (await res.json()) as { success: boolean }
      if (json.success) {
        haptic('medium')
        setSubmitted(true)
        setTimeout(() => {
          onClose()
          setSubmitted(false)
          setReason(null)
          setDetails('')
        }, 1500)
      }
    } catch {
      // Silent fail — report is best-effort
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50 glass-sheet rounded-t-3xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="px-5 pt-5 pb-[max(env(safe-area-inset-bottom),20px)] overflow-y-auto" style={{ maxHeight: 'calc(80dvh - env(safe-area-inset-bottom, 0px))' }}>
              {submitted ? (
                <div className="text-center py-8">
                  <p className="text-2xl mb-2">Thanks</p>
                  <p className="text-text-muted text-sm">Your report has been submitted.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-text font-bold text-lg">Report {targetType}</h2>
                    <button onClick={onClose} className="text-text-muted text-sm font-medium active:opacity-60">
                      Cancel
                    </button>
                  </div>

                  <div className="space-y-2 mb-4">
                    {REASONS.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => { haptic('light'); setReason(r.id) }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-[var(--r-lg)] border transition-all active:scale-[0.97] ${
                          reason === r.id
                            ? 'bg-accent/12 border-accent/40'
                            : 'glass'
                        }`}
                      >
                        <span className="text-base">{r.icon}</span>
                        <span className={`text-sm font-medium ${reason === r.id ? 'text-accent' : 'text-text'}`}>
                          {r.label}
                        </span>
                      </button>
                    ))}
                  </div>

                  {reason === 'other' && (
                    <textarea
                      value={details}
                      onChange={(e) => setDetails(e.target.value.slice(0, 500))}
                      placeholder="Please describe the issue…"
                      rows={3}
                      className="glass-input w-full rounded-[var(--r-md)] px-3.5 py-3 text-sm resize-none leading-relaxed mb-4"
                    />
                  )}

                  <button
                    onClick={() => void handleSubmit()}
                    disabled={!reason || isSubmitting}
                    className="w-full py-3 bg-downvote disabled:opacity-40 text-white text-sm font-semibold rounded-[var(--r-md)] transition-all active:scale-95"
                  >
                    {isSubmitting ? 'Submitting…' : 'Submit Report'}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
