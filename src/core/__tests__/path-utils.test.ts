import { describe, it, expect } from 'vitest'
import {
  encodeProjectPath,
  decodeProjectDirName,
  getProjectDisplayName,
  getProjectFamilyBasePath,
} from '../path-utils'

describe('encodeProjectPath', () => {
  it('encodes a POSIX path with a leading dash for the root', () => {
    expect(encodeProjectPath('/Users/ruskin/projects/foo')).toBe('-Users-ruskin-projects-foo')
  })

  it('encodes a Windows path: drive colon and backslashes both become dashes', () => {
    expect(encodeProjectPath('C:\\Users\\RuskinJanowski\\Documents')).toBe(
      'C--Users-RuskinJanowski-Documents',
    )
  })

  it('encodes a Windows path with forward slashes', () => {
    expect(encodeProjectPath('C:/Users/ruskin/Documents')).toBe('C--Users-ruskin-Documents')
  })

  it('encodes mixed separators consistently', () => {
    expect(encodeProjectPath('C:\\Users/ruskin\\projects')).toBe('C--Users-ruskin-projects')
  })

  it('encodes dots — Claude Code collapses `\\.claude` to `--claude`', () => {
    // Verified empirically: Claude Code's encoded folder name for a path
    // containing `\.claude\worktrees\...` has `--claude-worktrees-...`.
    expect(
      encodeProjectPath(
        'C:\\Users\\ruskin\\Documents\\refurb-stock-backend\\.claude\\worktrees\\elated-mclean-f2aacf',
      ),
    ).toBe(
      'C--Users-ruskin-Documents-refurb-stock-backend--claude-worktrees-elated-mclean-f2aacf',
    )
  })

  it('encodes dotfiles in POSIX paths', () => {
    expect(encodeProjectPath('/Users/me/.config/foo')).toBe('-Users-me--config-foo')
  })
})

describe('decodeProjectDirName', () => {
  it('decodes a POSIX directory name back to a POSIX path', () => {
    expect(decodeProjectDirName('-Users-ruskin-projects-foo')).toBe('/Users/ruskin/projects/foo')
  })

  it('decodes a Windows directory name back to a Windows path', () => {
    expect(decodeProjectDirName('C--Users-RuskinJanowski-Documents')).toBe(
      'C:\\Users\\RuskinJanowski\\Documents',
    )
  })

  it('handles non-C drive letters', () => {
    expect(decodeProjectDirName('D--projects-app')).toBe('D:\\projects\\app')
  })
})

describe('encode/decode round-trip', () => {
  // Encoding is lossy — '-' in original folder names cannot be recovered —
  // but for paths whose segments have no '-' the round-trip is exact, which
  // is enough for matching folders inside ~/.claude/projects/.

  it('round-trips a POSIX path with no dashes in any segment', () => {
    const original = '/Users/ruskin/Documents/app'
    expect(decodeProjectDirName(encodeProjectPath(original))).toBe(original)
  })

  it('round-trips a Windows path with no dashes in any segment', () => {
    const original = 'C:\\Users\\ruskin\\Documents\\app'
    expect(decodeProjectDirName(encodeProjectPath(original))).toBe(original)
  })
})

describe('getProjectFamilyBasePath', () => {
  it('strips a trailing POSIX worktree segment', () => {
    expect(
      getProjectFamilyBasePath('/Users/me/repo/.claude/worktrees/zen-gauss-c522fd'),
    ).toBe('/Users/me/repo')
  })

  it('strips a trailing Windows worktree segment', () => {
    expect(
      getProjectFamilyBasePath('C:\\Users\\me\\repo\\.claude\\worktrees\\zen-gauss'),
    ).toBe('C:\\Users\\me\\repo')
  })

  it('tolerates a trailing slash on the worktree segment', () => {
    expect(
      getProjectFamilyBasePath('/Users/me/repo/.claude/worktrees/wt1/'),
    ).toBe('/Users/me/repo')
  })

  it('leaves a plain project path unchanged', () => {
    expect(getProjectFamilyBasePath('/Users/me/repo')).toBe('/Users/me/repo')
  })

  it('does not strip a non-trailing worktrees-looking segment', () => {
    const p = '/Users/me/.claude/worktrees/x/src/app.ts'
    expect(getProjectFamilyBasePath(p)).toBe(p)
  })
})

describe('getProjectDisplayName', () => {
  it('returns the basename of a POSIX path', () => {
    expect(getProjectDisplayName('/Users/ruskin/projects/foo')).toBe('foo')
  })

  it('returns the basename of a Windows path with backslashes', () => {
    expect(getProjectDisplayName('C:\\Users\\ruskin\\Documents\\my-app')).toBe('my-app')
  })

  it('returns the basename of a Windows path with forward slashes', () => {
    expect(getProjectDisplayName('C:/Users/ruskin/Documents/my-app')).toBe('my-app')
  })

  it('falls back to the path itself when basename is empty', () => {
    expect(getProjectDisplayName('/')).toBe('/')
  })
})
