export default function NotificationsLoading() {
  return (
    <div className="w-full flex flex-col gap-3 px-4 py-6">
      {/* Page title */}
      <div className="h-7 w-36 bg-surface-up rounded-lg animate-pulse mb-2" />

      {/* Notification rows */}
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="glass rounded-[var(--r-lg)] p-4 animate-pulse flex items-start gap-3">
          <div className="h-8 w-8 bg-surface-up rounded-full shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 bg-surface-up rounded-full" />
            <div className="h-3 w-1/2 bg-surface-up rounded-full" />
          </div>
          <div className="h-2 w-2 bg-surface-up rounded-full shrink-0 mt-2" />
        </div>
      ))}
    </div>
  )
}
