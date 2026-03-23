import { RoomView } from '@/components/rooms/RoomView'
import { FeatureErrorBoundary } from '@/components/ui/FeatureErrorBoundary'

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <FeatureErrorBoundary name="Room">
      <RoomView roomId={id} />
    </FeatureErrorBoundary>
  )
}
