'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useArkoraStore } from '@/store/useArkoraStore'
import { haptic } from '@/lib/utils'

const SLIDES = [
  {
    icon: (
      <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
        <circle cx="26" cy="26" r="25" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.3" />
        <circle cx="26" cy="26" r="18" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.5" />
        <circle cx="26" cy="26" r="7" fill="currentColor" />
      </svg>
    ),
    heading: 'Arkora',
    sub: 'Real people. Real conversations.',
    body: 'Every voice here is Orb-verified by World ID. Real humans only — no bots, no noise, no exceptions.',
  },
  {
    icon: (
      <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
        <path d="M10 36 Q10 18 26 14 Q42 18 42 36" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" fill="none" strokeLinecap="round" />
        <circle cx="26" cy="14" r="5" fill="currentColor" />
        <rect x="8" y="34" width="36" height="10" rx="5" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" />
        <circle cx="20" cy="39" r="2" fill="currentColor" fillOpacity="0.6" />
        <circle cx="26" cy="39" r="2" fill="currentColor" fillOpacity="0.6" />
        <circle cx="32" cy="39" r="2" fill="currentColor" fillOpacity="0.6" />
      </svg>
    ),
    heading: 'Your rules, your voice',
    sub: 'Post anonymously or with your identity.',
    body: 'Choose how you show up: fully anonymous, a consistent alias, or your World ID handle.',
  },
  {
    icon: (
      <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
        <path d="M14 38 L26 10 L38 38" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18 30 L34 30" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" strokeLinecap="round" />
        <circle cx="26" cy="10" r="3.5" fill="currentColor" />
      </svg>
    ),
    heading: 'Verified, not surveilled',
    sub: 'Powered by World ID.',
    body: 'One wallet login proves you\'re human. No data collected, no identity exposed.',
  },
]

export function OnboardingScreen() {
  const { hasOnboarded, setHasOnboarded } = useArkoraStore()
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
  }

  const slide = SLIDES[step]!
  const isLast = step === SLIDES.length - 1

  // "Browse as guest" — dismiss onboarding, user views feed without verifying.
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
          className="w-full bg-accent text-white font-semibold py-4 rounded-[var(--r-lg)] text-base tracking-[-0.01em] shadow-lg shadow-accent/25 active:scale-[0.98] active:bg-accent-hover transition-all"
        >
          {isLast ? 'Verify & join' : 'Continue'}
        </button>

        {/* Guest option — only on last slide */}
        {isLast && (
          <button
            onClick={browseAsGuest}
            className="w-full mt-3 py-3.5 rounded-[var(--r-lg)] text-text-muted text-[15px] font-medium active:opacity-60 transition-opacity"
          >
            Browse without account →
          </button>
        )}
      </div>
    </motion.div>
  )
}
