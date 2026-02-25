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

export const metadata: Metadata = {
  title: 'Arkora',
  description: 'A provably human anonymous message board. Every voice is verified.',
  manifest: '/manifest.json',
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
          {/* Auto-triggers walletAuth on mount */}
          <SessionHydrator />
          <WalletConnect />
          <OnboardingScreen />
          <PostComposer />
          <VerifyHuman />
          <ErrorBoundary>
            <main className="pb-20 safe-top">{children}</main>
          </ErrorBoundary>
          <BottomNav />
        </MiniKitProvider>
      </body>
    </html>
  )
}
