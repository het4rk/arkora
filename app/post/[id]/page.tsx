import { ThreadView } from '@/components/thread/ThreadView'
import { FeatureErrorBoundary } from '@/components/ui/FeatureErrorBoundary'
import { getPostMetadata } from '@/lib/db/posts'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const post = await getPostMetadata(id)

  if (!post) {
    return {
      title: 'Post Not Found - Arkora',
      description: 'This post does not exist or has been removed.',
    }
  }

  const rawTitle = post.title || post.body || 'Discussion on Arkora'
  const title = rawTitle.length > 70 ? rawTitle.slice(0, 67) + '...' : rawTitle
  const fullTitle = `${title} - Arkora`
  const description =
    post.body && post.body.length > 0
      ? post.body.length > 160
        ? post.body.slice(0, 157) + '...'
        : post.body
      : 'Discussion on Arkora'

  const ogImage = `https://arkora.app/api/og?title=${encodeURIComponent(rawTitle.slice(0, 120))}&board=${encodeURIComponent(post.boardId ?? '')}&type=${post.type ?? 'text'}`

  return {
    title: fullTitle,
    description,
    openGraph: {
      title: fullTitle,
      description,
      type: 'article',
      siteName: 'Arkora',
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [ogImage],
    },
  }
}

export default async function ThreadPage({ params }: Props) {
  const { id } = await params
  if (!id) notFound()
  return (
    <FeatureErrorBoundary name="Thread">
      <ThreadView postId={id} />
    </FeatureErrorBoundary>
  )
}
