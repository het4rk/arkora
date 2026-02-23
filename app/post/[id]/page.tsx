import { ThreadView } from '@/components/thread/ThreadView'
import { notFound } from 'next/navigation'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ThreadPage({ params }: Props) {
  const { id } = await params
  if (!id) notFound()
  return <ThreadView postId={id} />
}
