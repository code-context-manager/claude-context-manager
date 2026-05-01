import { describe, it, expect } from 'vitest'
import { matchGlob, matchAnyGlob, normalizePath } from '../glob-match'

describe('normalizePath', () => {
  it('converts backslashes to forward slashes', () => {
    expect(normalizePath('src\\foo\\bar.ts')).toBe('src/foo/bar.ts')
  })
  it('strips leading ./', () => {
    expect(normalizePath('./src/foo.ts')).toBe('src/foo.ts')
  })
})

describe('matchGlob', () => {
  it('matches literal paths', () => {
    expect(matchGlob('src/foo.ts', 'src/foo.ts')).toBe(true)
    expect(matchGlob('src/foo.ts', 'src/bar.ts')).toBe(false)
  })

  it('matches * within a segment', () => {
    expect(matchGlob('src/*.ts', 'src/foo.ts')).toBe(true)
    expect(matchGlob('src/*.ts', 'src/sub/foo.ts')).toBe(false)
  })

  it('matches ** across segments', () => {
    expect(matchGlob('src/**/*.ts', 'src/a/b/c.ts')).toBe(true)
    expect(matchGlob('src/**/*.ts', 'src/a.ts')).toBe(true)
    expect(matchGlob('**/*.md', 'docs/deep/path/file.md')).toBe(true)
  })

  it('respects character classes', () => {
    expect(matchGlob('src/[abc].ts', 'src/a.ts')).toBe(true)
    expect(matchGlob('src/[abc].ts', 'src/d.ts')).toBe(false)
  })

  it('respects brace alternation', () => {
    expect(matchGlob('src/*.{ts,tsx}', 'src/foo.tsx')).toBe(true)
    expect(matchGlob('src/*.{ts,tsx}', 'src/foo.js')).toBe(false)
  })

  it('handles ? as single-char', () => {
    expect(matchGlob('src/fo?.ts', 'src/foo.ts')).toBe(true)
    expect(matchGlob('src/fo?.ts', 'src/fo.ts')).toBe(false)
  })
})

describe('matchAnyGlob', () => {
  it('returns false for empty list', () => {
    expect(matchAnyGlob([], 'foo.ts')).toBe(false)
  })

  it('true if any positive glob matches', () => {
    expect(matchAnyGlob(['src/**/*.ts', 'lib/**'], 'src/foo.ts')).toBe(true)
  })

  it('negation removes matches', () => {
    expect(matchAnyGlob(['src/**', '!src/ignore/**'], 'src/ignore/foo.ts')).toBe(false)
    expect(matchAnyGlob(['src/**', '!src/ignore/**'], 'src/keep/foo.ts')).toBe(true)
  })
})
