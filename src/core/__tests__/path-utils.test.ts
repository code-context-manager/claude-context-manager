import { describe, it, expect } from 'vitest'
import { encodeProjectPath, decodeProjectDirName } from '../path-utils'

describe('encodeProjectPath', () => {
  it('replaces slashes with dashes', () => {
    expect(encodeProjectPath('/Users/ruskin/projects/foo')).toBe('-Users-ruskin-projects-foo')
  })
})

describe('decodeProjectDirName', () => {
  it('restores slashes from dashes', () => {
    expect(decodeProjectDirName('-Users-ruskin-projects-foo')).toBe('/Users/ruskin/projects/foo')
  })
})
