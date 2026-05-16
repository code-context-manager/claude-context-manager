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

  it('collapses a worktree checkout into its parent repo (Windows path)', async () => {
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
    expect(projects[0].path).toBe('C:\\Users\\ruskin\\Documents\\refurb-stock-backend')
    expect(projects[0].name).toBe('refurb-stock-backend')
    expect(projects[0].lastUsed).toBe(1000)
  })

  it('collapses a worktree resolved via JSONL peek into its parent repo', async () => {
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
    expect(projects[0].path).toBe('C:\\Users\\ruskin\\Documents\\refurb-stock-backend')
    expect(projects[0].name).toBe('refurb-stock-backend')
  })

  it('merges main checkout and its worktrees into one entry with the latest lastUsed', async () => {
    const repo = '/Users/ruskin/projects/ccm'
    const wtA = `${repo}/.claude/worktrees/zen-gauss-c522fd`
    const wtB = `${repo}/.claude/worktrees/infallible-hypatia-440890`

    const projects = await listProjects(
      fakeFs(
        {
          [join(sessionsDir, 's1.json')]: JSON.stringify({ cwd: repo, startedAt: 1000 }),
          [join(sessionsDir, 's2.json')]: JSON.stringify({ cwd: wtA, startedAt: 3000 }),
          [join(sessionsDir, 's3.json')]: JSON.stringify({ cwd: wtB, startedAt: 2000 }),
        },
        {
          [sessionsDir]: ['s1.json', 's2.json', 's3.json'],
          [projectsDir]: [
            '-Users-ruskin-projects-ccm',
            '-Users-ruskin-projects-ccm--claude-worktrees-zen-gauss-c522fd',
            '-Users-ruskin-projects-ccm--claude-worktrees-infallible-hypatia-440890',
          ],
          [join(projectsDir, '-Users-ruskin-projects-ccm')]: [],
          [join(projectsDir, '-Users-ruskin-projects-ccm--claude-worktrees-zen-gauss-c522fd')]: [],
          [join(
            projectsDir,
            '-Users-ruskin-projects-ccm--claude-worktrees-infallible-hypatia-440890',
          )]: [],
        },
      ),
    )

    expect(projects).toHaveLength(1)
    expect(projects[0].path).toBe(repo)
    expect(projects[0].name).toBe('ccm')
    expect(projects[0].lastUsed).toBe(3000)
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
