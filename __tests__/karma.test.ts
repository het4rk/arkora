import { describe, it, expect } from 'vitest'
import { getKarmaTier, KARMA_TIERS } from '@/lib/karma'

describe('getKarmaTier', () => {
  it('returns newcomer for score 0', () => {
    expect(getKarmaTier(0).tier).toBe('newcomer')
  })

  it('returns newcomer for score just below contributor threshold', () => {
    expect(getKarmaTier(9).tier).toBe('newcomer')
  })

  it('returns contributor at threshold (10)', () => {
    expect(getKarmaTier(10).tier).toBe('contributor')
  })

  it('returns contributor for score between 10 and 99', () => {
    expect(getKarmaTier(50).tier).toBe('contributor')
    expect(getKarmaTier(99).tier).toBe('contributor')
  })

  it('returns trusted at threshold (100)', () => {
    expect(getKarmaTier(100).tier).toBe('trusted')
  })

  it('returns trusted for score between 100 and 499', () => {
    expect(getKarmaTier(250).tier).toBe('trusted')
    expect(getKarmaTier(499).tier).toBe('trusted')
  })

  it('returns elder at threshold (500)', () => {
    expect(getKarmaTier(500).tier).toBe('elder')
  })

  it('returns elder for high scores', () => {
    expect(getKarmaTier(1000).tier).toBe('elder')
    expect(getKarmaTier(999999).tier).toBe('elder')
  })

  it('returns newcomer for negative scores', () => {
    expect(getKarmaTier(-1).tier).toBe('newcomer')
    expect(getKarmaTier(-100).tier).toBe('newcomer')
  })

  it('returned tier config has required fields', () => {
    const config = getKarmaTier(500)
    expect(config).toHaveProperty('tier')
    expect(config).toHaveProperty('label')
    expect(config).toHaveProperty('minScore')
    expect(config).toHaveProperty('color')
    expect(config).toHaveProperty('bg')
  })
})

describe('KARMA_TIERS', () => {
  it('has 4 tiers', () => {
    expect(KARMA_TIERS).toHaveLength(4)
  })

  it('tiers are ordered by ascending minScore', () => {
    for (let i = 1; i < KARMA_TIERS.length; i++) {
      expect(KARMA_TIERS[i]!.minScore).toBeGreaterThan(KARMA_TIERS[i - 1]!.minScore)
    }
  })

  it('first tier starts at 0', () => {
    expect(KARMA_TIERS[0]!.minScore).toBe(0)
  })
})
