export default function SettingsLoading() {
  return (
    <div className="w-full flex flex-col gap-6 px-4 py-6">
      {/* Page title */}
      <div className="h-7 w-28 bg-surface-up rounded-lg animate-pulse" />

      {/* Section 1 */}
      <div className="glass rounded-[var(--r-lg)] p-5 animate-pulse">
        <div className="h-5 w-32 bg-surface-up rounded-lg mb-4" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-border/10 last:border-0">
            <div className="h-4 w-28 bg-surface-up rounded-full" />
            <div className="h-6 w-11 bg-surface-up rounded-full" />
          </div>
        ))}
      </div>

      {/* Section 2 */}
      <div className="glass rounded-[var(--r-lg)] p-5 animate-pulse">
        <div className="h-5 w-40 bg-surface-up rounded-lg mb-4" />
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-border/10 last:border-0">
            <div className="h-4 w-36 bg-surface-up rounded-full" />
            <div className="h-6 w-11 bg-surface-up rounded-full" />
          </div>
        ))}
      </div>

      {/* Section 3 */}
      <div className="glass rounded-[var(--r-lg)] p-5 animate-pulse">
        <div className="h-5 w-24 bg-surface-up rounded-lg mb-4" />
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-border/10 last:border-0">
            <div className="h-4 w-32 bg-surface-up rounded-full" />
            <div className="h-4 w-16 bg-surface-up rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
