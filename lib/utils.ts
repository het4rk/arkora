import { type ClassValue, clsx } from 'clsx'

// Tailwind class merging helper — install clsx if needed, otherwise inline it
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs)
}

// Convert a string (UUID or nullifier hash) to bytes32 for contract calls
export function stringToBytes32(value: string): `0x${string}` {
  // If it's already a hex string (nullifier hash), pad to 32 bytes
  if (value.startsWith('0x')) {
    return value.padEnd(66, '0') as `0x${string}`
  }
  // UUID: encode as UTF-8 bytes, right-pad with zeros
  const encoded = new TextEncoder().encode(value)
  const bytes = new Uint8Array(32)
  bytes.set(encoded.slice(0, 32))
  return (
    '0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
  ) as `0x${string}`
}

// Truncate a wallet address for display
export function truncateAddress(address: string): string {
  if (address.length < 10) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

// Haptic feedback — uses the Vibration API (supported in World App / Android WebView)
// Silently no-ops in Safari/desktop where the API is unavailable.
export function haptic(pattern: 'light' | 'medium' | 'heavy' = 'light'): void {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return
  const ms = pattern === 'light' ? 8 : pattern === 'medium' ? 18 : 32
  navigator.vibrate(ms)
}
