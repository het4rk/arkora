import { NotificationList } from '@/components/notifications/NotificationList'
import { FeatureErrorBoundary } from '@/components/ui/FeatureErrorBoundary'

export default function NotificationsPage() {
  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <div className="px-[5vw] pt-[max(env(safe-area-inset-top),20px)] pb-3 border-b border-border/25">
        <h1 className="text-text font-bold text-xl">Notifications</h1>
      </div>
      <FeatureErrorBoundary name="Notifications">
        <NotificationList />
      </FeatureErrorBoundary>
    </div>
  )
}
