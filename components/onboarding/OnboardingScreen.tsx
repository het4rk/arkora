'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useArkoraStore } from '@/store/useArkoraStore'
import { haptic } from '@/lib/utils'

const SLIDES = [
  {
    icon: (
      // Globe with human presence markers
      <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
        <circle cx="26" cy="26" r="22" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.35" />
        {/* Latitude lines */}
        <path d="M6 26 Q16 20 26 20 Q36 20 46 26" stroke="currentColor" strokeWidth="1" strokeOpacity="0.25" fill="none" />
        <path d="M6 26 Q16 32 26 32 Q36 32 46 26" stroke="currentColor" strokeWidth="1" strokeOpacity="0.25" fill="none" />
        {/* Vertical meridian */}
        <line x1="26" y1="4" x2="26" y2="48" stroke="currentColor" strokeWidth="1" strokeOpacity="0.2" />
        {/* Human presence dots across the globe */}
        <circle cx="16" cy="22" r="2.5" fill="currentColor" fillOpacity="0.7" />
        <circle cx="30" cy="18" r="2.5" fill="currentColor" fillOpacity="0.7" />
        <circle cx="38" cy="28" r="2.5" fill="currentColor" fillOpacity="0.7" />
        <circle cx="18" cy="34" r="2.5" fill="currentColor" fillOpacity="0.7" />
        <circle cx="26" cy="26" r="3.5" fill="currentColor" />
      </svg>
    ),
    heading: 'A home for humanity\u2019s voice',
    sub: 'Every country. Every context.',
    body: "Not built for algorithms or governments. Arkora is open to every verified human on earth - whether you\u2019re posting from a major city or a conflict zone. The only requirement is being real.",
  },
  {
    icon: (
      // Permanence / immutability - a sealed record
      <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
        <circle cx="26" cy="26" r="22" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.25" />
        {/* Shield shape */}
        <path d="M26 8 L40 14 L40 28 Q40 40 26 46 Q12 40 12 28 L12 14 Z" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.45" fill="none" strokeLinejoin="round" />
        {/* Inner solid shield */}
        <path d="M26 14 L36 18.5 L36 28 Q36 36 26 41 Q16 36 16 28 L16 18.5 Z" fill="currentColor" fillOpacity="0.12" />
        {/* Lock mark */}
        <rect x="22" y="26" width="8" height="6" rx="1.5" fill="currentColor" fillOpacity="0.7" />
        <path d="M23 26 L23 23.5 Q23 20 26 20 Q29 20 29 23.5 L29 26" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.6" fill="none" strokeLinecap="round" />
      </svg>
    ),
    heading: 'Incorruptible by design',
    sub: 'Built so no one controls your speech - including us.',
    body: "Arkora\u2019s governance is public, permanent, and resistant to pressure. No silent takedowns. No political interference. What verified humans say here stands.",
  },
  {
    icon: (
      // World ID orb - concentric rings with inner core
      <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
        <circle cx="26" cy="26" r="25" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.15" />
        <circle cx="26" cy="26" r="18" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.3" />
        <circle cx="26" cy="26" r="11" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.5" />
        <circle cx="26" cy="26" r="5" fill="currentColor" />
        {/* Orbit check */}
        <path d="M19 26.5 L23.5 31 L34 20" stroke="currentColor" strokeWidth="1.8" strokeOpacity="0.45" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    heading: 'One human. One voice.',
    sub: 'Verified. Private. Permanent.',
    body: "World ID proves you\u2019re a unique person on-chain without revealing who you are. No bots, no manufactured consensus - every voice here carries the full weight of a real, proven human.",
  },
]

export function OnboardingScreen() {
  const { hasOnboarded, setHasOnboarded, setVerifySheetOpen } = useArkoraStore()
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)

  if (hasOnboarded) return null

  function advance() {
    haptic('light')
    if (step < SLIDES.length - 1) {
      setDirection(1)
      setStep((s) => s + 1)
    } else {
      finish()
    }
  }

  function finish() {
    haptic('medium')
    setHasOnboarded(true)
    setVerifySheetOpen(true)
  }

  const slide = SLIDES[step]!
  const isLast = step === SLIDES.length - 1

  // "Browse as guest" - dismiss onboarding, user views feed without verifying.
  // Any action requiring identity will trigger the verify sheet naturally.
  function browseAsGuest() {
    haptic('light')
    setHasOnboarded(true)
  }

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Ambient background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[10%] w-[80%] h-[60%] rounded-full bg-accent/10 blur-[80px]" />
        <div className="absolute bottom-[10%] right-[-10%] w-[60%] h-[40%] rounded-full bg-accent/6 blur-[60px]" />
      </div>

      {/* Skip */}
      {!isLast && (
        <div className="relative px-6 pt-[max(env(safe-area-inset-top),20px)] flex justify-end">
          <button
            onClick={finish}
            className="text-text-muted text-sm font-medium active:opacity-60 transition-opacity py-2 px-1"
          >
            Skip
          </button>
        </div>
      )}
      {isLast && <div className="pt-[max(env(safe-area-inset-top),20px)]" />}

      {/* Slide content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            initial={{ opacity: 0, x: direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -40 }}
            transition={{ duration: 0.28, ease: [0.32, 0, 0.67, 0] }}
            className="flex flex-col items-center text-center w-full"
          >
            {/* Icon */}
            <div className="text-accent mb-8 opacity-90">
              {slide.icon}
            </div>

            {/* Heading */}
            <h1 className="text-[28px] font-bold text-text tracking-[-0.03em] leading-tight mb-3">
              {slide.heading}
            </h1>

            {/* Subheading */}
            <p className="text-accent text-[15px] font-semibold mb-4">
              {slide.sub}
            </p>

            {/* Body */}
            <p className="text-text-secondary text-[15px] leading-relaxed max-w-[280px]">
              {slide.body}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom controls */}
      <div className="relative px-8 pb-[max(env(safe-area-inset-bottom),36px)]">
        {/* Dot indicators */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {SLIDES.map((_, i) => (
            <motion.div
              key={i}
              animate={{
                width: i === step ? 20 : 6,
                opacity: i === step ? 1 : 0.3,
              }}
              transition={{ duration: 0.25 }}
              className="h-1.5 rounded-full bg-accent"
            />
          ))}
        </div>

        {/* Primary CTA */}
        <button
          onClick={advance}
          className="w-full bg-accent text-background font-semibold py-4 rounded-[var(--r-lg)] text-base tracking-[-0.01em] shadow-lg shadow-accent/25 active:scale-[0.98] active:bg-accent-hover transition-all"
        >
          {isLast ? 'Get started' : 'Continue'}
        </button>

        {/* Guest option - only on last slide */}
        {isLast && (
          <button
            onClick={browseAsGuest}
            className="w-full mt-3 py-3.5 rounded-[var(--r-lg)] text-text-muted text-[15px] font-medium active:opacity-60 transition-opacity"
          >
            Continue as guest
          </button>
        )}
      </div>
    </motion.div>
  )
}
