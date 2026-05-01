import { describe, it, expect } from 'vitest'
import { estimateTokens } from '../token-estimator'

describe('estimateTokens', () => {
  it('estimates ~4 chars per token', () => {
    expect(estimateTokens('abcd')).toBe(1)
    expect(estimateTokens('abcdefgh')).toBe(2)
  })

  it('rounds up', () => {
    expect(estimateTokens('ab')).toBe(1)
    expect(estimateTokens('abcde')).toBe(2)
  })

  it('handles empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })
})
