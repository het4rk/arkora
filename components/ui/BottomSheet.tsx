'use client'

import { useEffect, useRef, type ReactNode } from 'react'
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
  const sheetRef = useRef<HTMLDivElement>(null)
  const startY = useRef(0)
  const dragY = useRef(0)

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

  function onHandleTouchStart(e: React.TouchEvent) {
    startY.current = e.touches[0]!.clientY
    dragY.current = 0
  }

  function onHandleTouchMove(e: React.TouchEvent) {
    const delta = e.touches[0]!.clientY - startY.current
    if (delta > 0 && sheetRef.current) {
      dragY.current = delta
      sheetRef.current.style.transition = 'none'
      sheetRef.current.style.transform = `translateY(${delta}px)`
    }
  }

  function onHandleTouchEnd() {
    if (dragY.current > 80) {
      onClose()
    } else if (sheetRef.current) {
      sheetRef.current.style.transition = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)'
      sheetRef.current.style.transform = 'translateY(0px)'
      setTimeout(() => {
        if (sheetRef.current) sheetRef.current.style.transition = ''
      }, 300)
    }
    dragY.current = 0
  }

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
            ref={sheetRef}
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
            {/* Drag handle - touch this to swipe away */}
            <div
              className="flex justify-center pt-3.5 pb-1 cursor-grab touch-none"
              onTouchStart={onHandleTouchStart}
              onTouchMove={onHandleTouchMove}
              onTouchEnd={onHandleTouchEnd}
            >
              <div className="w-9 h-[3px] rounded-full bg-border/80" />
            </div>

            {title && (
              <div className="px-5 pt-2 pb-4 border-b border-border/20">
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
