import { ConversationView } from '@/components/dm/ConversationView'
import { FeatureErrorBoundary } from '@/components/ui/FeatureErrorBoundary'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ConversationPage({ params }: Props) {
  const { id } = await params
  return (
    <FeatureErrorBoundary name="Conversation">
      <ConversationView otherHash={id} />
    </FeatureErrorBoundary>
  )
}
