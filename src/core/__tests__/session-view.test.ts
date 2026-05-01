import { describe, it, expect } from 'vitest'
import type { FsReader } from '../fs'
import { buildSessionView } from '../session-view'
import { getGlobalClaudeMdPath, getProjectDataDir } from '../path-utils'
import { join } from 'path'

function jsonl(...lines: unknown[]): string {
  return lines.map((l) => JSON.stringify(l)).join('\n')
}

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
      return entries.map((name) => {
        const child = join(path, name)
        const isDirectory = !!dirs[child]
        return { name, isDirectory }
      })
    },
    async stat(path) {
      if (files[path] !== undefined) {
        return { isFile: true, isDirectory: false, mtimeMs: 0, birthtimeMs: 0 }
      }
      if (dirs[path]) {
        return { isFile: false, isDirectory: true, mtimeMs: 0, birthtimeMs: 0 }
      }
      return null
    },
  }
}

describe('buildSessionView — auto-loaded CLAUDE.md', () => {
  const projectPath = '/proj'
  const sessionId = 's1'
  const jsonlPath = join(getProjectDataDir(projectPath), `${sessionId}.jsonl`)
  const projectClaudeMd = join(projectPath, 'CLAUDE.md')
  const globalClaudeMd = getGlobalClaudeMdPath()

  it('synthesizes project + global CLAUDE.md entries even when the JSONL never read them', async () => {
    const fs = fakeFs(
      {
        [jsonlPath]: jsonl({ type: 'user', message: { content: 'hi' } }),
        [projectClaudeMd]: '# Project rules\n',
        [globalClaudeMd]: '# Global rules\n',
      },
      { [projectPath]: ['CLAUDE.md'] },
    )
    const view = await buildSessionView(fs, projectPath, sessionId)
    expect(view).not.toBeNull()
    const paths = view!.snapshot.files.map((f) => f.path)
    expect(paths).toContain(projectClaudeMd)
    expect(paths).toContain(globalClaudeMd)
    const chainPaths = view!.snapshot.claudeMdChain.map((c) => c.path)
    expect(chainPaths).toContain(projectClaudeMd)
    expect(chainPaths).toContain(globalClaudeMd)

    const projectEntry = view!.snapshot.files.find((f) => f.path === projectClaudeMd)
    expect(projectEntry?.reasons).toEqual([{ kind: 'project-static' }])
    expect(projectEntry?.tokens).toBeGreaterThan(0)

    const globalEntry = view!.snapshot.files.find((f) => f.path === globalClaudeMd)
    expect(globalEntry?.reasons).toEqual([{ kind: 'global-static' }])
  })

  it('does not duplicate CLAUDE.md when it was also explicitly read', async () => {
    const raw = jsonl(
      {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              id: 't1',
              name: 'Read',
              input: { file_path: projectClaudeMd },
            },
          ],
        },
      },
      {
        type: 'user',
        message: {
          content: [{ type: 'tool_result', tool_use_id: 't1', content: '# Project rules\n' }],
        },
      },
    )
    const fs = fakeFs(
      { [jsonlPath]: raw, [projectClaudeMd]: '# Project rules\n' },
      { [projectPath]: ['CLAUDE.md'] },
    )
    const view = await buildSessionView(fs, projectPath, sessionId)
    const matches = view!.snapshot.files.filter((f) => f.path === projectClaudeMd)
    expect(matches).toHaveLength(1)
    expect(matches[0].mechanisms).toContain('read')
    // Multi-reason: was both Read and project-static.
    const reasonKinds = matches[0].reasons?.map((r) => r.kind)
    expect(reasonKinds).toContain('tool-call')
    expect(reasonKinds).toContain('project-static')
  })

  it('adds folder-chain CLAUDE.md for ancestor folders of loaded files, tagged with the trigger', async () => {
    const folderClaudeMd = join(projectPath, 'src', 'CLAUDE.md')
    const loadedFile = join(projectPath, 'src', 'app.ts')
    const raw = jsonl(
      {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              id: 't1',
              name: 'Read',
              input: { file_path: loadedFile },
            },
          ],
        },
      },
      {
        type: 'user',
        message: {
          content: [{ type: 'tool_result', tool_use_id: 't1', content: 'export {}' }],
        },
      },
    )
    const fs = fakeFs(
      {
        [jsonlPath]: raw,
        [folderClaudeMd]: '# Src rules\n',
        [loadedFile]: 'export {}',
      },
      { [projectPath]: ['src'], [join(projectPath, 'src')]: ['CLAUDE.md', 'app.ts'] },
    )
    const view = await buildSessionView(fs, projectPath, sessionId)
    const folderEntry = view!.snapshot.files.find((f) => f.path === folderClaudeMd)
    expect(folderEntry).toBeDefined()
    expect(folderEntry?.reasons).toEqual([
      { kind: 'file-static', triggeredBy: loadedFile },
    ])
  })

  it('attaches a tool-call reason to JSONL-read files', async () => {
    const target = join(projectPath, 'src', 'a.ts')
    const raw = jsonl(
      {
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: target } },
          ],
        },
      },
      {
        type: 'user',
        message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: 'x' }] },
      },
    )
    const fs = fakeFs({ [jsonlPath]: raw, [target]: 'x' })
    const view = await buildSessionView(fs, projectPath, sessionId)
    const entry = view!.snapshot.files.find((f) => f.path === target)
    expect(entry?.reasons?.[0]).toMatchObject({ kind: 'tool-call', tool: 'read' })
  })

  it('skips CLAUDE.md that does not exist on disk', async () => {
    const fs = fakeFs({
      [jsonlPath]: jsonl({ type: 'user', message: { content: 'hi' } }),
    })
    const view = await buildSessionView(fs, projectPath, sessionId)
    expect(view!.snapshot.claudeMdChain).toEqual([])
  })
})
