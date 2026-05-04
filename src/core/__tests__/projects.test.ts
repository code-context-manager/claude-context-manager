import { describe, it, expect } from 'vitest'
import { join } from 'path'
import type { FsReader } from '../fs'
import { listProjects } from '../projects'
import { getProjectsDir } from '../path-utils'

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

describe('listProjects', () => {
  const projectsDir = getProjectsDir()
  const sessionsDir = join(projectsDir, '..', 'sessions')

  it('uses the cwd from session JSON to resolve a Windows worktree dir name', async () => {
    const winCwd =
      'C:\\Users\\ruskin\\Documents\\refurb-stock-backend\\.claude\\worktrees\\elated-mclean-f2aacf'
    const encodedDir =
      'C--Users-ruskin-Documents-refurb-stock-backend--claude-worktrees-elated-mclean-f2aacf'

    const projects = await listProjects(
      fakeFs(
        {
          [join(sessionsDir, 's1.json')]: JSON.stringify({ cwd: winCwd, startedAt: 1000 }),
        },
        {
          [sessionsDir]: ['s1.json'],
          [projectsDir]: [encodedDir],
          [join(projectsDir, encodedDir)]: [],
        },
      ),
    )

    expect(projects).toHaveLength(1)
    expect(projects[0].path).toBe(winCwd)
    expect(projects[0].name).toBe('elated-mclean-f2aacf')
    expect(projects[0].lastUsed).toBe(1000)
  })

  it('falls back to JSONL peek when no session JSON references the dir', async () => {
    const winCwd =
      'C:\\Users\\ruskin\\Documents\\refurb-stock-backend\\.claude\\worktrees\\elated-mclean-f2aacf'
    const encodedDir =
      'C--Users-ruskin-Documents-refurb-stock-backend--claude-worktrees-elated-mclean-f2aacf'
    const jsonlPath = join(projectsDir, encodedDir, 'abc.jsonl')

    const projects = await listProjects(
      fakeFs(
        {
          [jsonlPath]: JSON.stringify({ type: 'user', cwd: winCwd }) + '\n',
        },
        {
          [sessionsDir]: [],
          [projectsDir]: [encodedDir],
          [join(projectsDir, encodedDir)]: ['abc.jsonl'],
        },
      ),
    )

    expect(projects).toHaveLength(1)
    expect(projects[0].path).toBe(winCwd)
    expect(projects[0].name).toBe('elated-mclean-f2aacf')
  })

  it('falls back to dash-decoding only when neither source has cwd', async () => {
    const projects = await listProjects(
      fakeFs(
        {},
        {
          [sessionsDir]: [],
          [projectsDir]: ['-Users-ruskin-projects-foo'],
          [join(projectsDir, '-Users-ruskin-projects-foo')]: [],
        },
      ),
    )

    expect(projects).toHaveLength(1)
    expect(projects[0].path).toBe('/Users/ruskin/projects/foo')
    expect(projects[0].name).toBe('foo')
  })

  it('skips entries that are not encoded project dir names', async () => {
    const projects = await listProjects(
      fakeFs(
        {},
        {
          [sessionsDir]: [],
          [projectsDir]: ['.DS_Store', 'README.md', '-valid-project'],
          [join(projectsDir, '-valid-project')]: [],
        },
      ),
    )

    expect(projects.map((p) => p.path)).toEqual(['/valid/project'])
  })

  it('combines session-only cwds with directory entries (deduped)', async () => {
    const cwd = '/Users/me/proj'
    const projects = await listProjects(
      fakeFs(
        {
          [join(sessionsDir, 's1.json')]: JSON.stringify({ cwd, startedAt: 5000 }),
        },
        {
          [sessionsDir]: ['s1.json'],
          [projectsDir]: ['-Users-me-proj'],
          [join(projectsDir, '-Users-me-proj')]: [],
        },
      ),
    )

    expect(projects).toHaveLength(1)
    expect(projects[0].path).toBe(cwd)
    expect(projects[0].lastUsed).toBe(5000)
  })
})
