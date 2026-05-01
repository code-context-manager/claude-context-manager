import { describe, it, expect } from 'vitest'
import { folderChain } from '../folder-chain'

describe('folderChain', () => {
  it('returns dirs from root to target parent', () => {
    const chain = folderChain('/proj', '/proj/src/ui/Button.tsx')
    expect(chain).toEqual(['/proj/src', '/proj/src/ui'])
  })

  it('returns empty when target is at project root', () => {
    expect(folderChain('/proj', '/proj/README.md')).toEqual([])
  })

  it('returns empty when target is outside project', () => {
    expect(folderChain('/proj', '/other/foo.ts')).toEqual([])
  })

  it('handles trailing slash on root', () => {
    expect(folderChain('/proj/', '/proj/src/foo.ts')).toEqual(['/proj/src'])
  })
})
