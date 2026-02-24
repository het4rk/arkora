import { ConversationList } from '@/components/dm/ConversationList'

export default function DmPage() {
  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Header */}
      <div className="px-[5vw] pt-[max(env(safe-area-inset-top),20px)] pb-3 border-b border-border/25">
        <h1 className="text-text font-bold text-xl">Messages</h1>
        <p className="text-text-muted text-xs mt-0.5">End-to-end encrypted</p>
      </div>
      <ConversationList />
    </div>
  )
}
