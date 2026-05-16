import { describe, it, expect } from 'vitest'
import { join } from 'path'
import type { FsReader } from '../fs'
import { listSessionsForProject } from '../sessions'
import { getProjectsDir } from '../path-utils'

function fakeFs(
  files: Record<string, string>,
  dirs: Record<string, string[]> = {},
): FsReader {
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

function jsonl(ts: string, prompt: string): string {
  return JSON.stringify({ type: 'user', timestamp: ts, message: { content: prompt } }) + '\n'
}

const projectsDir = getProjectsDir()
const mainDir = join(projectsDir, '-Users-me-ccm')
const wtDir = join(projectsDir, '-Users-me-ccm--claude-worktrees-zen-gauss')

function familyFs(): FsReader {
  return fakeFs(
    {
      [join(mainDir, 's1.jsonl')]: jsonl('2026-05-10T10:00:00Z', 'main checkout work'),
      [join(wtDir, 's2.jsonl')]: jsonl('2026-05-15T10:00:00Z', 'worktree work'),
    },
    {
      [projectsDir]: ['-Users-me-ccm', '-Users-me-ccm--claude-worktrees-zen-gauss'],
      [mainDir]: ['s1.jsonl'],
      [wtDir]: ['s2.jsonl'],
    },
  )
}

describe('listSessionsForProject', () => {
  it('includes worktree sessions when listing the parent repo, newest first', async () => {
    const sessions = await listSessionsForProject(familyFs(), '/Users/me/ccm')

    expect(sessions.map((s) => s.id)).toEqual(['s2', 's1'])
    expect(sessions[0].firstPrompt).toBe('worktree work')
  })

  it('returns the same family list when listing from a worktree path', async () => {
    const sessions = await listSessionsForProject(
      familyFs(),
      '/Users/me/ccm/.claude/worktrees/zen-gauss',
    )

    expect(sessions.map((s) => s.id)).toEqual(['s2', 's1'])
  })

  it('dedupes a session reachable via both the literal dir and the family scan', async () => {
    const sessions = await listSessionsForProject(
      fakeFs(
        { [join(mainDir, 's1.jsonl')]: jsonl('2026-05-10T10:00:00Z', 'only session') },
        {
          [projectsDir]: ['-Users-me-ccm'],
          [mainDir]: ['s1.jsonl'],
        },
      ),
      '/Users/me/ccm',
    )

    expect(sessions).toHaveLength(1)
    expect(sessions[0].id).toBe('s1')
  })
})
