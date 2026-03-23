export default function DmListLoading() {
  return (
    <div className="w-full flex flex-col gap-3 px-4 py-6">
      {/* Page title */}
      <div className="h-7 w-32 bg-surface-up rounded-lg animate-pulse mb-2" />

      {/* Conversation rows */}
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="glass rounded-[var(--r-lg)] p-4 animate-pulse flex items-center gap-3">
          <div className="h-10 w-10 bg-surface-up rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-28 bg-surface-up rounded-full" />
            <div className="h-3 w-48 bg-surface-up rounded-full" />
          </div>
          <div className="h-3 w-10 bg-surface-up rounded-full shrink-0" />
        </div>
      ))}
    </div>
  )
}
