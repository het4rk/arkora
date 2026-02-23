'use client'

import { MiniKitProvider as WorldMiniKitProvider } from '@worldcoin/minikit-js/minikit-provider'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

// MiniKitProvider wraps the app for World App event interception.
// No appId prop — MiniKit reads it from the World App WebView context.
export function MiniKitProvider({ children }: Props) {
  return <WorldMiniKitProvider>{children}</WorldMiniKitProvider>
}
