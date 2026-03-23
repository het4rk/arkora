export default function ThreadLoading() {
  return (
    <div className="w-full flex flex-col gap-4 px-4 py-6">
      {/* Main post card */}
      <div className="glass rounded-[var(--r-lg)] p-5 animate-pulse">
        {/* Meta row */}
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 bg-surface-up rounded-full shrink-0" />
          <div className="h-4 w-24 bg-surface-up rounded-full" />
          <div className="ml-auto h-3 w-16 bg-surface-up rounded-full" />
        </div>
        {/* Title */}
        <div className="h-6 w-4/5 bg-surface-up rounded-lg mb-3" />
        {/* Body lines */}
        <div className="space-y-2 mb-4">
          <div className="h-4 w-full bg-surface-up rounded-lg" />
          <div className="h-4 w-full bg-surface-up rounded-lg" />
          <div className="h-4 w-3/5 bg-surface-up rounded-lg" />
        </div>
        {/* Action bar */}
        <div className="flex items-center gap-4 pt-4 border-t border-border/20">
          <div className="h-8 w-14 bg-surface-up rounded-full" />
          <div className="h-8 w-14 bg-surface-up rounded-full" />
          <div className="ml-auto h-8 w-8 bg-surface-up rounded-full" />
        </div>
      </div>

      {/* Reply skeletons */}
      {[0, 1, 2].map((i) => (
        <div key={i} className="glass rounded-[var(--r-lg)] p-4 animate-pulse">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-6 w-6 bg-surface-up rounded-full shrink-0" />
            <div className="h-3 w-20 bg-surface-up rounded-full" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full bg-surface-up rounded-lg" />
            <div className="h-4 w-2/3 bg-surface-up rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}
