import { describe, it, expect } from 'vitest'
import { join } from 'path'
import type { FsReader } from '../fs'
import { listSkillFiles, listAllSkillsForProject } from '../skills'
import { getGlobalSkillsDir } from '../path-utils'

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

describe('listSkillFiles', () => {
  const dir = '/skills'

  it('finds flat-layout skills (`<dir>/<name>.md`)', async () => {
    const fs = fakeFs(
      { [join(dir, 'init.md')]: '# init', [join(dir, 'review.md')]: '# review' },
      { [dir]: ['init.md', 'review.md'] },
    )
    const skills = await listSkillFiles(fs, dir, 'project')
    expect(skills.map((s) => s.displayName)).toEqual(['init.md', 'review.md'])
    expect(skills.every((s) => s.scope === 'project')).toBe(true)
  })

  it('finds packed-layout skills (`<dir>/<name>/SKILL.md`)', async () => {
    const fs = fakeFs(
      { [join(dir, 'refurb-infrastructure', 'SKILL.md')]: '# infra' },
      { [dir]: ['refurb-infrastructure'], [join(dir, 'refurb-infrastructure')]: ['SKILL.md'] },
    )
    const skills = await listSkillFiles(fs, dir, 'global')
    expect(skills).toHaveLength(1)
    expect(skills[0].displayName).toBe('refurb-infrastructure')
    expect(skills[0].filePath).toBe(join(dir, 'refurb-infrastructure', 'SKILL.md'))
    expect(skills[0].scope).toBe('global')
  })

  it('returns both layouts mixed in one directory', async () => {
    const fs = fakeFs(
      {
        [join(dir, 'flat.md')]: '# flat',
        [join(dir, 'packed', 'SKILL.md')]: '# packed',
      },
      { [dir]: ['flat.md', 'packed'], [join(dir, 'packed')]: ['SKILL.md'] },
    )
    const skills = await listSkillFiles(fs, dir, 'project')
    expect(skills.map((s) => s.displayName).sort()).toEqual(['flat.md', 'packed'])
  })

  it('skips directories that lack a SKILL.md', async () => {
    const fs = fakeFs(
      {},
      { [dir]: ['empty-pack'], [join(dir, 'empty-pack')]: ['readme.txt'] },
    )
    const skills = await listSkillFiles(fs, dir, 'project')
    expect(skills).toEqual([])
  })

  it('returns [] when the skills dir does not exist', async () => {
    const fs = fakeFs({}, {})
    expect(await listSkillFiles(fs, dir, 'project')).toEqual([])
  })
})

describe('listAllSkillsForProject', () => {
  it('combines project-scope and global-scope skills, project first', async () => {
    const projectPath = '/proj'
    const projectSkills = join(projectPath, '.claude', 'skills')
    const globalSkills = getGlobalSkillsDir()

    const fs = fakeFs(
      {
        [join(projectSkills, 'local.md')]: '# local',
        [join(globalSkills, 'pipeline-templates', 'SKILL.md')]: '# pipelines',
      },
      {
        [projectSkills]: ['local.md'],
        [globalSkills]: ['pipeline-templates'],
        [join(globalSkills, 'pipeline-templates')]: ['SKILL.md'],
      },
    )

    const skills = await listAllSkillsForProject(fs, projectPath)
    expect(skills.map((s) => s.scope)).toEqual(['project', 'global'])
    expect(skills.map((s) => s.displayName)).toEqual(['local.md', 'pipeline-templates'])
  })
})
