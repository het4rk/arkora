'use client'

export function TopBar() {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-30 glass-nav-top"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="max-w-[640px] mx-auto">
        <div className="h-14" />
      </div>
    </header>
  )
}
