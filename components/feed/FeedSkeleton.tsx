export function FeedSkeleton() {
  return (
    <div className="h-screen w-full bg-background flex flex-col justify-between p-5 animate-pulse">
      {/* Header area */}
      <div className="space-y-4 pt-4">
        {/* Board tag */}
        <div className="h-5 w-24 bg-surface-up rounded-full" />
        {/* Title */}
        <div className="space-y-2">
          <div className="h-7 w-full bg-surface-up rounded-xl" />
          <div className="h-7 w-3/4 bg-surface-up rounded-xl" />
        </div>
        {/* Human badge */}
        <div className="h-6 w-32 bg-surface-up rounded-full" />

        {/* Top reply box */}
        <div className="bg-surface-up rounded-2xl p-4 mt-6 space-y-2">
          <div className="h-4 w-16 bg-surface rounded-full" />
          <div className="h-4 w-full bg-surface rounded-xl" />
          <div className="h-4 w-4/5 bg-surface rounded-xl" />
        </div>
      </div>

      {/* Bottom area */}
      <div className="flex items-center justify-between pb-2">
        <div className="flex gap-3">
          <div className="h-9 w-20 bg-surface-up rounded-full" />
          <div className="h-9 w-20 bg-surface-up rounded-full" />
        </div>
        <div className="h-5 w-20 bg-surface-up rounded-full" />
      </div>
    </div>
  )
}
