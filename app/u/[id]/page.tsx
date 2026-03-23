import { PublicProfileView } from '@/components/profile/PublicProfileView'
import { FeatureErrorBoundary } from '@/components/ui/FeatureErrorBoundary'
import { getUserMetadata } from '@/lib/db/users'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const user = await getUserMetadata(id)

  if (!user) {
    return {
      title: 'Profile - Arkora',
      description: 'User profile on Arkora',
    }
  }

  const handle = user.pseudoHandle
  const title = handle ? `${handle}'s Profile - Arkora` : 'Profile - Arkora'
  const description =
    user.bio && user.bio.length > 0
      ? user.bio.length > 160
        ? user.bio.slice(0, 157) + '...'
        : user.bio
      : 'User profile on Arkora'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      siteName: 'Arkora',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export default async function PublicProfilePage({ params }: Props) {
  const { id } = await params
  return (
    <FeatureErrorBoundary name="Profile">
      <PublicProfileView nullifierHash={id} />
    </FeatureErrorBoundary>
  )
}
