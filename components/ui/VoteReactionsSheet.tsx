'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { haptic } from '@/lib/utils'

interface Voter {
  display: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  postId: string
  upvoteCount: number
  downvoteCount: number
  initialTab?: 'up' | 'down'
}

export function VoteReactionsSheet({ isOpen, onClose, postId, upvoteCount, downvoteCount, initialTab = 'up' }: Props) {
  const [tab, setTab] = useState<'up' | 'down'>(initialTab)
  const [upvoters, setUpvoters] = useState<Voter[]>([])
  const [downvoters, setDownvoters] = useState<Voter[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setTab(initialTab)
    setLoading(true)
    fetch(`/api/vote/reactions?postId=${postId}`)
      .then((r) => r.json())
      .then((json: { success: boolean; data?: { upvoters: Voter[]; downvoters: Voter[] } }) => {
        if (json.success && json.data) {
          setUpvoters(json.data.upvoters)
          setDownvoters(json.data.downvoters)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isOpen, postId, initialTab])

  const list = tab === 'up' ? upvoters : downvoters

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
            <div
              className="px-5 pt-5 pb-[max(env(safe-area-inset-bottom),20px)] flex flex-col"
              style={{ maxHeight: 'calc(65dvh - env(safe-area-inset-bottom, 0px))' }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-text font-bold text-lg">Reactions</h2>
                <button onClick={onClose} className="text-text-muted text-sm font-medium active:opacity-60">
                  Close
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => { haptic('light'); setTab('up') }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                    tab === 'up' ? 'bg-upvote text-white' : 'glass text-text-muted'
                  }`}
                >
                  <svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M6 1L11.196 9.5H0.804L6 1Z" />
                  </svg>
                  {upvoteCount}
                </button>
                <button
                  onClick={() => { haptic('light'); setTab('down') }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                    tab === 'down' ? 'bg-downvote text-white' : 'glass text-text-muted'
                  }`}
                >
                  <svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M6 11L0.804 2.5H11.196L6 11Z" />
                  </svg>
                  {downvoteCount}
                </button>
              </div>

              {/* Voter list */}
              <div className="overflow-y-auto flex-1">
                {loading ? (
                  <p className="text-text-muted text-sm text-center py-8">Loading…</p>
                ) : list.length === 0 ? (
                  <p className="text-text-muted text-sm text-center py-8">
                    No {tab === 'up' ? 'upvotes' : 'downvotes'} yet
                  </p>
                ) : (
                  <div className="space-y-1">
                    {list.map((v, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-3 rounded-[var(--r-md)] glass">
                        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-accent text-xs font-bold">
                            {v.display[0]?.toUpperCase() ?? '?'}
                          </span>
                        </div>
                        <span className="text-text text-sm font-medium">{v.display}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
