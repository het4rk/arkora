import { ConversationView } from '@/components/dm/ConversationView'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ConversationPage({ params }: Props) {
  const { id } = await params
  return <ConversationView otherHash={id} />
}
