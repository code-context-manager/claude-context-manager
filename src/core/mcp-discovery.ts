import { join } from 'path'
import type { FsReader } from './fs'
import type { ClaudeCli, ClaudeMcpScope } from './claude-cli'
import type { McpServerConfig } from './types'
import { parseSettingsJson, parseUserClaudeJson } from './claude-parser'
import {
  getGlobalSettingsPath,
  getProjectMcpJsonPath,
  getUserClaudeJsonPath,
} from './path-utils'

/**
 * Single source of truth for "what MCP servers does Claude Code load for this
 * project?" — used by both the inventory view (`scanProject`) and the
 * static-load view (`computeProjectStaticLoad`). Following ADR 0011: CLI is
 * primary when available, filesystem fallback covers all four config
 * locations Claude Code resolves from.
 *
 * Each record carries enough provenance for callers to map into their own
 * shape without branching on the origin of the discovery.
 */
export interface DiscoveredMcpServer {
  name: string
  /** Semantic scope: 'global' loads in every project; 'project' is bound here. */
  scope: 'global' | 'project'
  /** Claude's own scope label, surfaced in the UI. */
  claudeScope: ClaudeMcpScope
  /** File the inventory should point at when the user wants to "see source". */
  sourceFile: string
  /** Populated only on the filesystem path; the CLI doesn't return command/args. */
  config?: McpServerConfig
}

export async function discoverMcpServers(
  fs: FsReader,
  projectPath: string,
  cli?: ClaudeCli,
): Promise<DiscoveredMcpServer[]> {
  if (cli) {
    const cliServers = await cli.listMcpServers(projectPath)
    if (cliServers !== null) {
      const sourceFile = getUserClaudeJsonPath()
      return cliServers.map((s) => ({
        name: s.name,
        scope: cliMcpScopeToContextScope(s.scope),
        claudeScope: s.scope ?? 'project',
        sourceFile,
      }))
    }
  }
  return discoverFromFilesystem(fs, projectPath)
}

function cliMcpScopeToContextScope(
  scope: ClaudeMcpScope | undefined,
): 'global' | 'project' {
  // Claude's `user` scope loads everywhere; `project` and `local` are bound
  // to one project. Default unknown to project (most common case).
  return scope === 'user' ? 'global' : 'project'
}

async function discoverFromFilesystem(
  fs: FsReader,
  projectPath: string,
): Promise<DiscoveredMcpServer[]> {
  const out: DiscoveredMcpServer[] = []

  const settingsTargets: {
    path: string
    scope: 'global' | 'project'
    claudeScope: ClaudeMcpScope
  }[] = [
    { path: getGlobalSettingsPath(), scope: 'global', claudeScope: 'user' },
    {
      path: join(projectPath, '.claude', 'settings.json'),
      scope: 'project',
      claudeScope: 'project',
    },
    {
      path: getProjectMcpJsonPath(projectPath),
      scope: 'project',
      claudeScope: 'project',
    },
  ]
  for (const { path, scope, claudeScope } of settingsTargets) {
    const raw = await fs.readFile(path)
    if (!raw) continue
    const { mcpServers } = parseSettingsJson(raw)
    for (const config of mcpServers) {
      out.push({ name: config.name, scope, claudeScope, sourceFile: path, config })
    }
  }

  const userClaudeJsonPath = getUserClaudeJsonPath()
  const userClaudeJsonContent = await fs.readFile(userClaudeJsonPath)
  if (userClaudeJsonContent) {
    const { userScopeMcp, projectScopeMcp } = parseUserClaudeJson(
      userClaudeJsonContent,
      projectPath,
    )
    for (const config of userScopeMcp) {
      out.push({
        name: config.name,
        scope: 'global',
        claudeScope: 'user',
        sourceFile: userClaudeJsonPath,
        config,
      })
    }
    for (const config of projectScopeMcp) {
      out.push({
        name: config.name,
        scope: 'project',
        claudeScope: 'local',
        sourceFile: userClaudeJsonPath,
        config,
      })
    }
  }

  return out
}
