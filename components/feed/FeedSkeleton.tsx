export function FeedSkeleton() {
  return (
    <div className="w-full bg-background flex flex-col px-5 pt-10 pb-6 border-b border-border/20 animate-pulse">
      {/* Meta row */}
      <div className="flex items-center justify-between mb-5">
        <div className="h-4 w-20 bg-surface-up rounded-full" />
        <div className="h-4 w-12 bg-surface-up rounded-full" />
      </div>

      {/* Title */}
      <div className="flex flex-col space-y-3">
        <div className="h-9 w-full bg-surface-up rounded-xl" />
        <div className="h-9 w-5/6 bg-surface-up rounded-xl" />
        <div className="h-9 w-2/3 bg-surface-up rounded-xl" />

        {/* Human badge */}
        <div className="h-7 w-36 bg-surface-up rounded-full mt-1" />

        {/* Top reply box */}
        <div className="mt-5 bg-surface rounded-2xl px-4 py-3.5 border border-border/60 space-y-2">
          <div className="h-3 w-16 bg-surface-up rounded-full" />
          <div className="h-4 w-full bg-surface-up rounded-lg" />
          <div className="h-4 w-4/5 bg-surface-up rounded-lg" />
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between pt-5 border-t border-border/40 mt-4">
        <div className="flex items-center gap-2">
          <div className="h-9 w-16 bg-surface-up rounded-full" />
          <div className="h-9 w-16 bg-surface-up rounded-full" />
        </div>
        <div className="h-4 w-16 bg-surface-up rounded-full" />
      </div>
    </div>
  )
}
