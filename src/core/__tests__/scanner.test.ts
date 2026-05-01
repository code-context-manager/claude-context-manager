import { describe, it, expect } from 'vitest'
import { join } from 'path'
import type { FsReader } from '../fs'
import type { ClaudeCli } from '../claude-cli'
import { scanProject } from '../scanner'
import { ContextType } from '../types'
import { getUserClaudeJsonPath } from '../path-utils'

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

const nullCli: ClaudeCli = {
  async listMcpServers() {
    return null
  },
}

const stubCli = (servers: { name: string; scope?: 'project' | 'user' | 'local' }[]): ClaudeCli => ({
  async listMcpServers() {
    return servers
  },
})

describe('scanProject — MCP discovery', () => {
  const projectPath = '/proj'

  it('falls back to filesystem when CLI returns null and surfaces project-scoped servers from ~/.claude.json with structured details', async () => {
    const fs = fakeFs({
      [getUserClaudeJsonPath()]: JSON.stringify({
        mcpServers: {},
        projects: {
          [projectPath]: {
            mcpServers: {
              'claude-context-manager': {
                type: 'stdio',
                command: 'node',
                args: ['/proj/out/mcp/index.mjs'],
                env: { DEBUG: '1', SECRET_TOKEN: 'shh' },
              },
            },
          },
        },
      }),
    })

    const sources = await scanProject(fs, projectPath, nullCli)
    const mcps = sources.filter((s) => s.type === ContextType.McpServer)
    expect(mcps).toHaveLength(1)
    expect(mcps[0]).toMatchObject({
      name: 'claude-context-manager',
      scope: 'project',
      mcp: {
        transport: 'stdio',
        command: 'node',
        args: ['/proj/out/mcp/index.mjs'],
        envKeys: ['DEBUG', 'SECRET_TOKEN'],
        sourceFile: getUserClaudeJsonPath(),
        claudeScope: 'local',
      },
    })
  })

  it('does not leak env-var values into mcp details (envKeys only)', async () => {
    const fs = fakeFs({
      [getUserClaudeJsonPath()]: JSON.stringify({
        projects: {
          [projectPath]: {
            mcpServers: { srv: { command: 'x', env: { TOKEN: 'sensitive-secret' } } },
          },
        },
      }),
    })
    const sources = await scanProject(fs, projectPath, nullCli)
    const serialized = JSON.stringify(sources)
    expect(serialized).not.toContain('sensitive-secret')
    expect(serialized).toContain('TOKEN')
  })

  it('falls back to filesystem when no CLI is provided', async () => {
    const fs = fakeFs({
      [getUserClaudeJsonPath()]: JSON.stringify({
        projects: {
          [projectPath]: {
            mcpServers: { 'fs-only': { command: 'x' } },
          },
        },
      }),
    })

    const sources = await scanProject(fs, projectPath)
    const mcps = sources.filter((s) => s.type === ContextType.McpServer)
    expect(mcps.map((m) => m.name)).toEqual(['fs-only'])
  })

  it('uses the CLI as primary when it returns a list, ignoring filesystem config', async () => {
    const fs = fakeFs({
      [getUserClaudeJsonPath()]: JSON.stringify({
        projects: { [projectPath]: { mcpServers: { 'fs-only': { command: 'x' } } } },
      }),
    })

    const sources = await scanProject(
      fs,
      projectPath,
      stubCli([{ name: 'cli-server', scope: 'local' }]),
    )
    const mcps = sources.filter((s) => s.type === ContextType.McpServer)
    expect(mcps.map((m) => m.name)).toEqual(['cli-server'])
    // CLI path doesn't carry command/args (the parser doesn't extract them
    // yet); claudeScope still rides along so the detail view can label it.
    expect(mcps[0].mcp).toMatchObject({ claudeScope: 'local' })
    expect(mcps[0].mcp?.command).toBeUndefined()
  })

  it('returns no MCP entries when CLI reports an empty list (CLI wins over disk)', async () => {
    const fs = fakeFs({
      [getUserClaudeJsonPath()]: JSON.stringify({
        projects: { [projectPath]: { mcpServers: { 'fs-only': { command: 'x' } } } },
      }),
    })

    const sources = await scanProject(fs, projectPath, stubCli([]))
    expect(sources.filter((s) => s.type === ContextType.McpServer)).toEqual([])
  })
})
