import { describe, it, expect } from 'vitest'
import { sanitizeText, sanitizeLine, parseMentions } from '@/lib/sanitize'

describe('sanitizeText', () => {
  it('returns plain text unchanged (aside from trim)', () => {
    expect(sanitizeText('hello world')).toBe('hello world')
  })

  it('trims leading and trailing whitespace', () => {
    expect(sanitizeText('  hello  ')).toBe('hello')
  })

  it('strips C0 control characters', () => {
    expect(sanitizeText('hello\x00world')).toBe('helloworld')
    expect(sanitizeText('hello\x07world')).toBe('helloworld') // bell
    expect(sanitizeText('hello\x1Fworld')).toBe('helloworld')
  })

  it('preserves newline, tab, and carriage return', () => {
    expect(sanitizeText('line1\nline2')).toBe('line1\nline2')
    expect(sanitizeText('col1\tcol2')).toBe('col1\tcol2')
  })

  it('collapses 3+ consecutive newlines to 2', () => {
    expect(sanitizeText('a\n\n\nb')).toBe('a\n\nb')
    expect(sanitizeText('a\n\n\n\n\nb')).toBe('a\n\nb')
  })

  it('preserves exactly 2 newlines', () => {
    expect(sanitizeText('a\n\nb')).toBe('a\n\nb')
  })

  it('strips zero-width characters', () => {
    expect(sanitizeText('hello\u200Bworld')).toBe('helloworld') // zero-width space
    expect(sanitizeText('hello\uFEFFworld')).toBe('helloworld') // BOM
    expect(sanitizeText('hello\u2060world')).toBe('helloworld') // word joiner
  })

  it('NFKC-normalizes unicode (homoglyph prevention)', () => {
    // ﬁ (U+FB01 LATIN SMALL LIGATURE FI) → fi
    expect(sanitizeText('\uFB01le')).toBe('file')
    // ² (U+00B2) → 2
    expect(sanitizeText('x\u00B2')).toBe('x2')
  })

  it('handles empty string', () => {
    expect(sanitizeText('')).toBe('')
  })
})

describe('sanitizeLine', () => {
  it('collapses all internal whitespace to single spaces', () => {
    expect(sanitizeLine('hello   world')).toBe('hello world')
    expect(sanitizeLine('hello\t\tworld')).toBe('hello world')
    expect(sanitizeLine('hello\nworld')).toBe('hello world')
  })

  it('trims leading and trailing whitespace', () => {
    expect(sanitizeLine('  hello  ')).toBe('hello')
  })

  it('strips control characters', () => {
    expect(sanitizeLine('hello\x00world')).toBe('helloworld')
  })

  it('strips zero-width characters', () => {
    expect(sanitizeLine('hello\u200Bworld')).toBe('helloworld')
  })

  it('handles empty string', () => {
    expect(sanitizeLine('')).toBe('')
  })

  it('NFKC-normalizes unicode', () => {
    expect(sanitizeLine('\uFB01le')).toBe('file')
  })
})

describe('parseMentions', () => {
  it('extracts a single mention', () => {
    expect(parseMentions('hello @alice')).toEqual(['alice'])
  })

  it('extracts multiple mentions', () => {
    expect(parseMentions('@alice and @bob')).toEqual(['alice', 'bob'])
  })

  it('deduplicates repeated mentions', () => {
    expect(parseMentions('@alice @alice @bob @alice')).toEqual(['alice', 'bob'])
  })

  it('preserves mention order (first occurrence)', () => {
    expect(parseMentions('@charlie @alice @bob')).toEqual(['charlie', 'alice', 'bob'])
  })

  it('does not match @ in the middle of a word', () => {
    expect(parseMentions('user@example.com')).toEqual([])
  })

  it('allows hyphens and underscores in handles', () => {
    expect(parseMentions('@john_doe @jane-smith')).toEqual(['john_doe', 'jane-smith'])
  })

  it('returns empty array when no mentions', () => {
    expect(parseMentions('no mentions here')).toEqual([])
  })

  it('handles empty string', () => {
    expect(parseMentions('')).toEqual([])
  })

  it('caps handle length at 50 characters', () => {
    const long = 'a'.repeat(51)
    const result = parseMentions(`@${long}`)
    // regex stops at 50 chars so only first 50 matched
    expect(result[0]?.length).toBeLessThanOrEqual(50)
  })
})
