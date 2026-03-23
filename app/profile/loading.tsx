export default function ProfileLoading() {
  return (
    <div className="w-full flex flex-col gap-4 px-4 py-6">
      {/* Profile header */}
      <div className="glass rounded-[var(--r-lg)] p-5 animate-pulse">
        <div className="flex items-center gap-4 mb-4">
          <div className="h-16 w-16 bg-surface-up rounded-full shrink-0" />
          <div className="space-y-2">
            <div className="h-5 w-32 bg-surface-up rounded-full" />
            <div className="h-4 w-24 bg-surface-up rounded-full" />
          </div>
        </div>
        {/* Bio lines */}
        <div className="space-y-2 mb-4">
          <div className="h-4 w-full bg-surface-up rounded-lg" />
          <div className="h-4 w-3/4 bg-surface-up rounded-lg" />
        </div>
        {/* Stats row */}
        <div className="flex items-center gap-6 pt-4 border-t border-border/20">
          <div className="h-4 w-16 bg-surface-up rounded-full" />
          <div className="h-4 w-16 bg-surface-up rounded-full" />
          <div className="h-4 w-16 bg-surface-up rounded-full" />
        </div>
      </div>

      {/* Post placeholders */}
      {[0, 1].map((i) => (
        <div key={i} className="glass rounded-[var(--r-lg)] p-4 animate-pulse">
          <div className="h-5 w-3/4 bg-surface-up rounded-lg mb-2" />
          <div className="h-4 w-full bg-surface-up rounded-lg mb-1" />
          <div className="h-4 w-2/3 bg-surface-up rounded-lg" />
        </div>
      ))}
    </div>
  )
}
