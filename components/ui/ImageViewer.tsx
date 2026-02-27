'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  src: string
  isOpen: boolean
  onClose: () => void
}

export function ImageViewer({ src, isOpen, onClose }: Props) {
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setImgError(false)
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          {imgError ? (
            <div className="flex flex-col items-center gap-3 text-white/60 px-8 text-center">
              <p className="text-4xl">🖼️</p>
              <p className="text-sm">Image could not be loaded.</p>
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={src}
              alt=""
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
              onError={() => setImgError(true)}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
