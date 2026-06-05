import { describe, it, expect } from 'vitest'
import { join } from 'path'
import type { FsReader } from '../fs'
import { listRuleFiles, listAllRulesForProject } from '../rules'
import { getProjectRulesDir, getUserRulesDir } from '../path-utils'

function fakeFs(files: Record<string, string>, dirs: Record<string, string[]> = {}): FsReader {
  return {
    async readFile(path) {
      return files[path] ?? null
    },
    async readdir(path) {
      return dirs[path] ?? null
    },
    async readdirWithTypes(path) {
      const entries = dirs[path]
      if (!entries) return null
      return entries.map((name) => ({ name, isDirectory: !!dirs[join(path, name)] }))
    },
    async stat(path) {
      if (files[path] !== undefined) {
        return { isFile: true, isDirectory: false, mtimeMs: 0, birthtimeMs: 0 }
      }
      if (dirs[path]) return { isFile: false, isDirectory: true, mtimeMs: 0, birthtimeMs: 0 }
      return null
    },
  }
}

describe('listRuleFiles', () => {
  const dir = '/rules'

  it('returns [] when the directory does not exist', async () => {
    const fs = fakeFs({})
    expect(await listRuleFiles(fs, dir, 'project')).toEqual([])
  })

  it('lists flat .md rules and ignores non-markdown files', async () => {
    const fs = fakeFs(
      {
        [join(dir, 'a.md')]: 'a',
        [join(dir, 'b.md')]: 'b',
        [join(dir, 'README.txt')]: 'x',
      },
      { [dir]: ['a.md', 'b.md', 'README.txt'] },
    )
    const refs = await listRuleFiles(fs, dir, 'project')
    expect(refs.map((r) => r.filePath)).toEqual([join(dir, 'a.md'), join(dir, 'b.md')])
    expect(refs.every((r) => r.scope === 'project')).toBe(true)
  })

  it('discovers rules in nested subdirectories recursively', async () => {
    const sub = join(dir, 'backend')
    const fs = fakeFs(
      { [join(dir, 'top.md')]: 't', [join(sub, 'db.md')]: 'd' },
      { [dir]: ['top.md', 'backend'], [sub]: ['db.md'] },
    )
    const refs = await listRuleFiles(fs, dir, 'project')
    expect(refs.map((r) => r.filePath).sort()).toEqual(
      [join(dir, 'top.md'), join(sub, 'db.md')].sort(),
    )
  })
})

describe('listAllRulesForProject', () => {
  const projectPath = '/proj'

  it('returns user-scope rules first, then project-scope', async () => {
    const userDir = getUserRulesDir()
    const projDir = getProjectRulesDir(projectPath)
    const fs = fakeFs(
      { [join(userDir, 'u.md')]: 'u', [join(projDir, 'p.md')]: 'p' },
      { [userDir]: ['u.md'], [projDir]: ['p.md'] },
    )
    const refs = await listAllRulesForProject(fs, projectPath)
    expect(refs).toEqual([
      { filePath: join(userDir, 'u.md'), scope: 'global' },
      { filePath: join(projDir, 'p.md'), scope: 'project' },
    ])
  })

  it('returns [] when neither rules dir exists', async () => {
    const fs = fakeFs({})
    expect(await listAllRulesForProject(fs, projectPath)).toEqual([])
  })
})
