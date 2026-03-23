import { RoomsDiscovery } from '@/components/rooms/RoomsDiscovery'
import { FeatureErrorBoundary } from '@/components/ui/FeatureErrorBoundary'

export default function RoomsPage() {
  return (
    <FeatureErrorBoundary name="Rooms">
      <RoomsDiscovery />
    </FeatureErrorBoundary>
  )
}
