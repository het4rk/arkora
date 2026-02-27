import { describe, it, expect } from 'vitest'
import { truncateAddress, formatDisplayName, stringToBytes32 } from '@/lib/utils'

describe('truncateAddress', () => {
  it('truncates a full EVM address', () => {
    const addr = '0x1234567890abcdef1234567890abcdef12345678'
    expect(truncateAddress(addr)).toBe('0x1234…5678')
  })

  it('returns short strings unchanged', () => {
    expect(truncateAddress('0x1234')).toBe('0x1234')
    expect(truncateAddress('short')).toBe('short')
  })

  it('uses ellipsis character (…)', () => {
    const result = truncateAddress('0x1234567890abcdef1234567890abcdef12345678')
    expect(result).toContain('…')
  })

  it('keeps first 6 and last 4 chars', () => {
    const addr = '0xABCDEF1234567890ABCDEF'
    const result = truncateAddress(addr)
    expect(result.startsWith('0xABCD')).toBe(true)
    expect(result.endsWith('CDEF')).toBe(true)
  })
})

describe('formatDisplayName', () => {
  it('title-cases a simple name', () => {
    expect(formatDisplayName('alice')).toBe('Alice')
  })

  it('splits on underscores', () => {
    expect(formatDisplayName('john_doe')).toBe('John Doe')
  })

  it('splits on dots', () => {
    expect(formatDisplayName('alice.smith')).toBe('Alice Smith')
  })

  it('splits on hyphens', () => {
    expect(formatDisplayName('bob-jones')).toBe('Bob Jones')
  })

  it('splits on spaces', () => {
    expect(formatDisplayName('hello world')).toBe('Hello World')
  })

  it('handles multiple separators', () => {
    expect(formatDisplayName('a_b.c-d')).toBe('A B C D')
  })

  it('handles empty string', () => {
    expect(formatDisplayName('')).toBe('')
  })

  it('handles single character', () => {
    expect(formatDisplayName('a')).toBe('A')
  })
})

describe('stringToBytes32', () => {
  it('pads a hex nullifier hash to 32 bytes (66 chars)', () => {
    const hash = '0xabc123'
    const result = stringToBytes32(hash)
    expect(result).toMatch(/^0x[0-9a-f]{64}$/i)
    expect(result.length).toBe(66)
  })

  it('starts with 0x for hex input', () => {
    expect(stringToBytes32('0x1234').startsWith('0x')).toBe(true)
  })

  it('encodes a UUID as bytes32', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    const result = stringToBytes32(uuid)
    expect(result).toMatch(/^0x[0-9a-f]{64}$/)
    expect(result.length).toBe(66)
  })

  it('returns a valid hex string for non-hex input', () => {
    const result = stringToBytes32('hello')
    expect(result).toMatch(/^0x[0-9a-f]{64}$/)
  })
})
