import { describe, it, expect } from 'vitest'
import { join } from 'path'
import type { FsReader } from '../fs'
import type { ClaudeCli } from '../claude-cli'
import { computeFileStaticLoad, computeProjectStaticLoad } from '../static-load'
import {
  getGlobalClaudeMdPath,
  getProjectMemoryPath,
  getUserClaudeJsonPath,
} from '../path-utils'

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
        return { name, isDirectory: !!dirs[child] }
      })
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

describe('computeProjectStaticLoad', () => {
  const projectPath = '/proj'

  it('always includes synthetic system-prompt and env-info entries', async () => {
    const fs = fakeFs({})
    const result = await computeProjectStaticLoad(fs, projectPath)
    const kinds = result.entries.map((e) => e.kind)
    expect(kinds).toContain('system-prompt')
    expect(kinds).toContain('env-info')
  })

  it('emits global and project CLAUDE.md when the files exist', async () => {
    const fs = fakeFs({
      [getGlobalClaudeMdPath()]: '# global',
      [join(projectPath, 'CLAUDE.md')]: '# project',
    })
    const result = await computeProjectStaticLoad(fs, projectPath)
    const kinds = result.entries.map((e) => e.kind)
    expect(kinds).toContain('global-claude-md')
    expect(kinds).toContain('project-claude-md')
    const proj = result.entries.find((e) => e.kind === 'project-claude-md')
    expect(proj?.scope).toBe('project')
    expect(proj?.tokens).toBeGreaterThan(0)
  })

  it('skips CLAUDE.md entries that do not exist on disk', async () => {
    const fs = fakeFs({})
    const result = await computeProjectStaticLoad(fs, projectPath)
    expect(result.entries.find((e) => e.kind === 'global-claude-md')).toBeUndefined()
    expect(result.entries.find((e) => e.kind === 'project-claude-md')).toBeUndefined()
  })

  it('emits MEMORY.md with the loaded-window token estimate', async () => {
    const memContent = '- a\n'.repeat(50)
    const fs = fakeFs({ [getProjectMemoryPath(projectPath)]: memContent })
    const result = await computeProjectStaticLoad(fs, projectPath)
    const mem = result.entries.find((e) => e.kind === 'memory')
    expect(mem).toBeDefined()
    expect(mem?.tokens).toBeGreaterThan(0)
  })

  it('emits always-apply rules but skips path-scoped ones', async () => {
    const rulesDir = join(projectPath, '.claude', 'rules')
    const fs = fakeFs(
      {
        [join(rulesDir, 'always.md')]: '---\nalwaysApply: true\n---\nbody',
        [join(rulesDir, 'scoped.md')]: '---\npaths:\n  - src/**\n---\nbody',
      },
      { [rulesDir]: ['always.md', 'scoped.md'] },
    )
    const result = await computeProjectStaticLoad(fs, projectPath)
    const rules = result.entries.filter((e) => e.kind === 'rule')
    expect(rules).toHaveLength(1)
    expect(rules[0].label).toBe('always.md')
    expect(rules[0].alwaysApply).toBe(true)
  })

  it('emits mcp-index entries for project-local servers in ~/.claude.json (regression for static-load missing the dominant config path)', async () => {
    const fs = fakeFs({
      [getUserClaudeJsonPath()]: JSON.stringify({
        projects: {
          [projectPath]: {
            mcpServers: {
              'claude-context-manager': { type: 'stdio', command: 'node' },
            },
          },
        },
      }),
    })
    const result = await computeProjectStaticLoad(fs, projectPath)
    const mcp = result.entries.filter((e) => e.kind === 'mcp-index')
    expect(mcp).toHaveLength(1)
    expect(mcp[0].label).toBe('MCP: claude-context-manager')
    expect(mcp[0].scope).toBe('project')
    expect(mcp[0].filePath).toBe(getUserClaudeJsonPath())
  })

  it('uses the CLI as primary MCP source when one is supplied', async () => {
    const fs = fakeFs({
      [getUserClaudeJsonPath()]: JSON.stringify({
        projects: { [projectPath]: { mcpServers: { 'fs-only': { command: 'x' } } } },
      }),
    })
    const cli: ClaudeCli = {
      async listMcpServers() {
        return [{ name: 'cli-server', scope: 'local' }]
      },
    }
    const result = await computeProjectStaticLoad(fs, projectPath, cli)
    const mcp = result.entries.filter((e) => e.kind === 'mcp-index')
    expect(mcp.map((e) => e.label)).toEqual(['MCP: cli-server'])
  })

  it('totalTokens sums all entry tokens', async () => {
    const fs = fakeFs({})
    const result = await computeProjectStaticLoad(fs, projectPath)
    const sum = result.entries.reduce((a, e) => a + e.tokens, 0)
    expect(result.totalTokens).toBe(sum)
  })
})

describe('computeFileStaticLoad', () => {
  const projectPath = '/proj'

  it('returns the folder-chain CLAUDE.mds along the path', async () => {
    const filePath = join(projectPath, 'src', 'features', 'auth.ts')
    const fs = fakeFs({
      [join(projectPath, 'src', 'CLAUDE.md')]: '# src rules',
      [join(projectPath, 'src', 'features', 'CLAUDE.md')]: '# features rules',
    })
    const result = await computeFileStaticLoad(fs, projectPath, filePath)
    const folderMds = result.entries.filter((e) => e.kind === 'folder-claude-md')
    expect(folderMds).toHaveLength(2)
    expect(folderMds.every((e) => e.scope === 'file')).toBe(true)
    expect(folderMds.every((e) => e.triggeredBy === filePath)).toBe(true)
  })

  it('matches path-scoped rules whose globs cover the file', async () => {
    const filePath = join(projectPath, 'src', 'foo.ts')
    const rulesDir = join(projectPath, '.claude', 'rules')
    const fs = fakeFs(
      {
        [join(rulesDir, 'src.md')]: '---\npaths:\n  - src/**\n---\nbody',
        [join(rulesDir, 'tests.md')]: '---\npaths:\n  - tests/**\n---\nbody',
      },
      { [rulesDir]: ['src.md', 'tests.md'] },
    )
    const result = await computeFileStaticLoad(fs, projectPath, filePath)
    const rules = result.entries.filter((e) => e.kind === 'rule')
    expect(rules).toHaveLength(1)
    expect(rules[0].label).toBe('src.md')
    expect(rules[0].pathGlobs).toEqual(['src/**'])
  })

  it('skips always-apply rules (those are project-static, not file-static)', async () => {
    const rulesDir = join(projectPath, '.claude', 'rules')
    const fs = fakeFs(
      {
        [join(rulesDir, 'always.md')]: '---\nalwaysApply: true\n---\nbody',
      },
      { [rulesDir]: ['always.md'] },
    )
    const result = await computeFileStaticLoad(fs, projectPath, join(projectPath, 'a.ts'))
    expect(result.entries.filter((e) => e.kind === 'rule')).toEqual([])
  })

  it('returns no entries for files outside the project root', async () => {
    const fs = fakeFs({})
    const result = await computeFileStaticLoad(fs, projectPath, '/somewhere/else/x.ts')
    expect(result.entries).toEqual([])
  })
})
