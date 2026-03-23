export default function RoomsLoading() {
  return (
    <div className="w-full flex flex-col gap-3 px-4 py-6">
      {/* Page title */}
      <div className="h-7 w-24 bg-surface-up rounded-lg animate-pulse mb-2" />

      {/* Room cards */}
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="glass rounded-[var(--r-lg)] p-4 animate-pulse">
          <div className="flex items-center justify-between mb-3">
            <div className="h-5 w-40 bg-surface-up rounded-lg" />
            <div className="h-5 w-14 bg-surface-up rounded-full" />
          </div>
          <div className="h-4 w-full bg-surface-up rounded-lg mb-2" />
          <div className="flex items-center gap-2">
            <div className="h-3 w-20 bg-surface-up rounded-full" />
            <div className="h-3 w-16 bg-surface-up rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}
