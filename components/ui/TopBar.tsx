'use client'

export function TopBar() {
  return (
    <header
      className="fixed top-0 z-30 glass-nav-top app-fixed"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="h-14" />
    </header>
  )
}
