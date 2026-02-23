'use client'

import { useEffect, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface Props {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  title?: string
  className?: string
}

export function BottomSheet({ isOpen, onClose, children, title, className }: Props) {
  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            className={cn(
              'fixed bottom-0 left-0 right-0 z-50',
              'glass-sheet',
              'rounded-t-3xl',
              'max-h-[90dvh] overflow-y-auto',
              'safe-bottom',
              className
            )}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3.5 pb-1">
              <div className="w-9 h-[3px] rounded-full bg-white/20" />
            </div>

            {title && (
              <div className="px-5 pt-2 pb-4 border-b border-white/[0.07]">
                <h2 className="text-text font-bold text-lg tracking-[-0.02em]">{title}</h2>
              </div>
            )}

            <div className="px-5 pb-8 pt-5">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
