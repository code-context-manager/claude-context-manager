import { describe, it, expect } from 'vitest'
import { homedir } from 'os'
import { join } from 'path'
import type { FsReader } from '../fs'
import { resolveClaudeMdImports } from '../imports'

function fakeFs(files: Record<string, string>): FsReader {
  return {
    async readFile(path) {
      return files[path] ?? null
    },
    async readdir() {
      return null
    },
    async readdirWithTypes() {
      return null
    },
    async stat(path) {
      return files[path] !== undefined
        ? { isFile: true, isDirectory: false, mtimeMs: 0, birthtimeMs: 0 }
        : null
    },
  }
}

describe('resolveClaudeMdImports', () => {
  const claudeMd = '/proj/CLAUDE.md'

  it('returns [] when there are no imports', async () => {
    const fs = fakeFs({})
    expect(await resolveClaudeMdImports(fs, 'no imports here', claudeMd)).toEqual([])
  })

  it('resolves a relative import against the importing file’s directory', async () => {
    const fs = fakeFs({ [join('/proj', 'docs', 'git.md')]: 'git workflow' })
    const out = await resolveClaudeMdImports(fs, 'See @docs/git.md for the flow.', claudeMd)
    expect(out).toHaveLength(1)
    expect(out[0].filePath).toBe(join('/proj', 'docs', 'git.md'))
    expect(out[0].tokens).toBeGreaterThan(0)
    expect(out[0].importedBy).toBe(claudeMd)
  })

  it('resolves absolute and ~ home imports', async () => {
    const home = join(homedir(), '.claude', 'shared.md')
    const fs = fakeFs({ '/etc/abs.md': 'abs', [home]: 'home' })
    const out = await resolveClaudeMdImports(fs, '@/etc/abs.md and @~/.claude/shared.md', claudeMd)
    expect(out.map((i) => i.filePath).sort()).toEqual([home, '/etc/abs.md'].sort())
  })

  it('skips specs that do not resolve to a readable file (emails, stray @words)', async () => {
    const fs = fakeFs({})
    const out = await resolveClaudeMdImports(fs, 'ping me@example.com or @nonexistent', claudeMd)
    expect(out).toEqual([])
  })

  it('ignores @paths inside fenced code blocks and inline code spans', async () => {
    const fs = fakeFs({ [join('/proj', 'real.md')]: 'real' })
    const body = [
      'Import @real.md here.',
      '```',
      'example: @fake-in-fence.md',
      '```',
      'and `@fake-in-span.md` inline',
    ].join('\n')
    const out = await resolveClaudeMdImports(fs, body, claudeMd)
    expect(out.map((i) => i.filePath)).toEqual([join('/proj', 'real.md')])
  })

  it('strips trailing punctuation from the matched path', async () => {
    const fs = fakeFs({ [join('/proj', 'README.md')]: 'readme' })
    const out = await resolveClaudeMdImports(fs, 'See @README.md, then build.', claudeMd)
    expect(out.map((i) => i.filePath)).toEqual([join('/proj', 'README.md')])
  })

  it('expands recursively but caps at four hops', async () => {
    const f = (n: string) => join('/proj', n)
    const fs = fakeFs({
      [f('a.md')]: 'a @b.md',
      [f('b.md')]: 'b @c.md',
      [f('c.md')]: 'c @d.md',
      [f('d.md')]: 'd @e.md',
      [f('e.md')]: 'e (too deep)',
    })
    const out = await resolveClaudeMdImports(fs, 'root @a.md', claudeMd)
    const names = out.map((i) => i.filePath)
    expect(names).toContain(f('a.md'))
    expect(names).toContain(f('d.md'))
    expect(names).not.toContain(f('e.md'))
  })

  it('de-duplicates cycles and repeated imports by absolute path', async () => {
    const f = (n: string) => join('/proj', n)
    const fs = fakeFs({ [f('a.md')]: 'a @b.md', [f('b.md')]: 'b @a.md' })
    const out = await resolveClaudeMdImports(fs, '@a.md and @a.md again', claudeMd)
    expect(out.map((i) => i.filePath)).toEqual([f('a.md'), f('b.md')])
  })
})
