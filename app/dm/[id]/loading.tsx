export default function ConversationLoading() {
  return (
    <div className="w-full flex flex-col gap-3 px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 animate-pulse">
        <div className="h-8 w-8 bg-surface-up rounded-full shrink-0" />
        <div className="h-5 w-28 bg-surface-up rounded-full" />
      </div>

      {/* Message bubbles */}
      <div className="flex justify-start">
        <div className="glass rounded-[var(--r-lg)] p-3 max-w-[70%] animate-pulse">
          <div className="h-4 w-44 bg-surface-up rounded-lg mb-1" />
          <div className="h-4 w-28 bg-surface-up rounded-lg" />
        </div>
      </div>

      <div className="flex justify-end">
        <div className="glass rounded-[var(--r-lg)] p-3 max-w-[70%] animate-pulse">
          <div className="h-4 w-36 bg-surface-up rounded-lg" />
        </div>
      </div>

      <div className="flex justify-start">
        <div className="glass rounded-[var(--r-lg)] p-3 max-w-[70%] animate-pulse">
          <div className="h-4 w-52 bg-surface-up rounded-lg mb-1" />
          <div className="h-4 w-40 bg-surface-up rounded-lg" />
        </div>
      </div>

      <div className="flex justify-end">
        <div className="glass rounded-[var(--r-lg)] p-3 max-w-[70%] animate-pulse">
          <div className="h-4 w-48 bg-surface-up rounded-lg mb-1" />
          <div className="h-4 w-20 bg-surface-up rounded-lg" />
        </div>
      </div>
    </div>
  )
}
