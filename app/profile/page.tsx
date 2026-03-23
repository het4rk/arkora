import { ProfileView } from '@/components/profile/ProfileView'
import { FeatureErrorBoundary } from '@/components/ui/FeatureErrorBoundary'

export default function ProfilePage() {
  return (
    <FeatureErrorBoundary name="Profile">
      <ProfileView />
    </FeatureErrorBoundary>
  )
}
