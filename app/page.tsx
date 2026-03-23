import { Feed } from '@/components/feed/Feed'
import { FeatureErrorBoundary } from '@/components/ui/FeatureErrorBoundary'

export default function HomePage() {
  return (
    <FeatureErrorBoundary name="Feed">
      <Feed />
    </FeatureErrorBoundary>
  )
}
