import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-8 text-center">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted mb-5"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
      <p className="font-bold text-text text-xl mb-2">Page not found</p>
      <p className="text-text-secondary text-sm mb-8 max-w-[260px]">
        This page doesn&apos;t exist or was removed.
      </p>
      <Link
        href="/"
        className="bg-accent text-background font-semibold py-3.5 px-6 rounded-[var(--r-lg)] text-sm active:scale-[0.98] active:bg-accent-hover transition-all shadow-lg shadow-accent/25"
      >
        Back to feed
      </Link>
    </div>
  )
}
