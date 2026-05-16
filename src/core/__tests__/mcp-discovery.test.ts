import { describe, it, expect } from 'vitest'
import { join } from 'path'
import type { FsReader } from '../fs'
import type { ClaudeCli } from '../claude-cli'
import { discoverMcpServers } from '../mcp-discovery'
import {
  getGlobalSettingsPath,
  getProjectMcpJsonPath,
  getUserClaudeJsonPath,
} from '../path-utils'

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
      if (files[path] !== undefined) {
        return { isFile: true, isDirectory: false, mtimeMs: 0, birthtimeMs: 0 }
      }
      return null
    },
  }
}

const nullCli: ClaudeCli = {
  async listMcpServers() {
    return null
  },
}

describe('discoverMcpServers', () => {
  const projectPath = '/proj'

  it('finds servers in ~/.claude.json projects[<path>].mcpServers (the regression case)', async () => {
    // This is the single config location that was previously invisible to
    // computeProjectStaticLoad — and where `claude mcp add` writes by default.
    const fs = fakeFs({
      [getUserClaudeJsonPath()]: JSON.stringify({
        projects: {
          [projectPath]: {
            mcpServers: {
              'claude-context-manager': {
                type: 'stdio',
                command: 'node',
                args: ['/proj/out/mcp/index.mjs'],
              },
            },
          },
        },
      }),
    })

    const servers = await discoverMcpServers(fs, projectPath)
    expect(servers).toHaveLength(1)
    expect(servers[0]).toMatchObject({
      name: 'claude-context-manager',
      scope: 'project',
      claudeScope: 'local',
      sourceFile: getUserClaudeJsonPath(),
    })
    expect(servers[0].config?.command).toBe('node')
  })

  it('dedupes a server registered at both user and project scope (narrowest wins)', async () => {
    // The real-world bug: claude-context-manager self-registers user-scope in
    // ~/.claude.json's top-level mcpServers AND a project-scope entry also
    // exists under projects[<path>].mcpServers. Claude Code loads it once.
    const fs = fakeFs({
      [getUserClaudeJsonPath()]: JSON.stringify({
        mcpServers: {
          'claude-context-manager': { command: 'node', args: ['user.mjs'] },
        },
        projects: {
          [projectPath]: {
            mcpServers: {
              'claude-context-manager': { command: 'node', args: ['proj.mjs'] },
            },
          },
        },
      }),
    })

    const servers = await discoverMcpServers(fs, projectPath)
    expect(servers).toHaveLength(1)
    // local (project-scope) is narrower than user → it wins.
    expect(servers[0]).toMatchObject({
      name: 'claude-context-manager',
      scope: 'project',
      claudeScope: 'local',
    })
  })

  it('finds servers across all four filesystem locations', async () => {
    const fs = fakeFs({
      [getGlobalSettingsPath()]: JSON.stringify({
        mcpServers: { 'global-settings-srv': { command: 'a' } },
      }),
      [join(projectPath, '.claude', 'settings.json')]: JSON.stringify({
        mcpServers: { 'project-settings-srv': { command: 'b' } },
      }),
      [getProjectMcpJsonPath(projectPath)]: JSON.stringify({
        mcpServers: { 'mcp-json-srv': { command: 'c' } },
      }),
      [getUserClaudeJsonPath()]: JSON.stringify({
        mcpServers: { 'user-claude-json-srv': { command: 'd' } },
        projects: {
          [projectPath]: {
            mcpServers: { 'project-local-srv': { command: 'e' } },
          },
        },
      }),
    })

    const servers = await discoverMcpServers(fs, projectPath)
    const names = servers.map((s) => s.name).sort()
    expect(names).toEqual([
      'global-settings-srv',
      'mcp-json-srv',
      'project-local-srv',
      'project-settings-srv',
      'user-claude-json-srv',
    ])

    const byName = Object.fromEntries(servers.map((s) => [s.name, s]))
    expect(byName['global-settings-srv'].claudeScope).toBe('user')
    expect(byName['project-settings-srv'].claudeScope).toBe('project')
    expect(byName['mcp-json-srv'].claudeScope).toBe('project')
    expect(byName['user-claude-json-srv'].claudeScope).toBe('user')
    expect(byName['project-local-srv'].claudeScope).toBe('local')

    expect(byName['global-settings-srv'].scope).toBe('global')
    expect(byName['user-claude-json-srv'].scope).toBe('global')
    expect(byName['project-local-srv'].scope).toBe('project')
  })

  it('uses the CLI as primary when it returns servers, ignoring the filesystem', async () => {
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

    const servers = await discoverMcpServers(fs, projectPath, cli)
    expect(servers).toHaveLength(1)
    expect(servers[0]).toMatchObject({
      name: 'cli-server',
      scope: 'project',
      claudeScope: 'local',
    })
    // CLI path doesn't carry config (command/args/env are not in `claude mcp list` output yet).
    expect(servers[0].config).toBeUndefined()
  })

  it('falls back to the filesystem when the CLI returns null', async () => {
    const fs = fakeFs({
      [getUserClaudeJsonPath()]: JSON.stringify({
        projects: { [projectPath]: { mcpServers: { 'fs-srv': { command: 'x' } } } },
      }),
    })

    const servers = await discoverMcpServers(fs, projectPath, nullCli)
    expect(servers.map((s) => s.name)).toEqual(['fs-srv'])
  })

  it('returns an empty list when the CLI reports zero servers (CLI wins over disk)', async () => {
    const fs = fakeFs({
      [getUserClaudeJsonPath()]: JSON.stringify({
        projects: { [projectPath]: { mcpServers: { 'fs-srv': { command: 'x' } } } },
      }),
    })
    const cli: ClaudeCli = {
      async listMcpServers() {
        return []
      },
    }
    const servers = await discoverMcpServers(fs, projectPath, cli)
    expect(servers).toEqual([])
  })

  it('returns an empty list when no config files exist', async () => {
    const fs = fakeFs({})
    const servers = await discoverMcpServers(fs, projectPath)
    expect(servers).toEqual([])
  })
})
