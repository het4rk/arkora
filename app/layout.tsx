import type { Metadata, Viewport } from 'next'
import './globals.css'
import { MiniKitProvider } from '@/components/providers/MiniKitProvider'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { WalletConnect } from '@/components/auth/WalletConnect'
import { BottomNav } from '@/components/ui/BottomNav'
import { OnboardingScreen } from '@/components/onboarding/OnboardingScreen'
import { PostComposer } from '@/components/compose/PostComposer'
import { VerifyHuman } from '@/components/auth/VerifyHuman'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { SessionHydrator } from '@/components/auth/SessionHydrator'
import { TopBar } from '@/components/ui/TopBar'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/next'

export const metadata: Metadata = {
  metadataBase: new URL('https://arkora.vercel.app'),
  title: 'Arkora',
  description: 'A provably human anonymous message board. Every voice is verified.',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Arkora',
    description: 'A provably human anonymous message board. Every voice is verified.',
    url: 'https://arkora.vercel.app',
    siteName: 'Arkora',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Arkora — Every voice is verified' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Arkora',
    description: 'A provably human anonymous message board. Every voice is verified.',
    images: ['/og-image.png'],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-background text-text min-h-screen">
        <MiniKitProvider>
          <ThemeProvider />
          <TopBar />
          {/* Auto-triggers walletAuth on mount */}
          <SessionHydrator />
          <WalletConnect />
          <OnboardingScreen />
          <PostComposer />
          <VerifyHuman />
          <ErrorBoundary>
            <main className="pb-20 safe-top-bar max-w-[640px] mx-auto">{children}</main>
          </ErrorBoundary>
          <BottomNav />
          <SpeedInsights />
          <Analytics />
        </MiniKitProvider>
      </body>
    </html>
  )
}
