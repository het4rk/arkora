import { PublicProfileView } from '@/components/profile/PublicProfileView'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PublicProfilePage({ params }: Props) {
  const { id } = await params
  return <PublicProfileView nullifierHash={id} />
}
