'use client'

import dynamic from 'next/dynamic'

const VerifyHuman = dynamic(
  () => import('@/components/auth/VerifyHuman').then(m => ({ default: m.VerifyHuman })),
  { ssr: false }
)

export function VerifyHumanLazy() {
  return <VerifyHuman />
}
