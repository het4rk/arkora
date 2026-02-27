'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { haptic } from '@/lib/utils'

const REASONS: { id: string; label: string; icon: JSX.Element }[] = [
  { id: 'spam', label: 'Spam', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg> },
  { id: 'harassment', label: 'Harassment', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="18" y1="8" x2="23" y2="13" /><line x1="23" y1="8" x2="18" y2="13" /></svg> },
  { id: 'hate', label: 'Hate speech', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg> },
  { id: 'violence', label: 'Violence', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg> },
  { id: 'misinformation', label: 'Misinformation', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></svg> },
  { id: 'other', label: 'Other', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg> },
]

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
                        <div className="text-text-muted shrink-0">{r.icon}</div>
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
                    className="w-full py-3 bg-accent disabled:opacity-40 text-background text-sm font-semibold rounded-[var(--r-md)] transition-all active:scale-95"
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
