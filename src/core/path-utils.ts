import { homedir } from 'os'
import { join, basename } from 'path'

export function getClaudeHome(): string {
  return join(homedir(), '.claude')
}

export function getGlobalClaudeMdPath(): string {
  return join(getClaudeHome(), 'CLAUDE.md')
}

export function getGlobalSettingsPath(): string {
  return join(getClaudeHome(), 'settings.json')
}

export function getGlobalSkillsDir(): string {
  return join(getClaudeHome(), 'skills')
}

/**
 * Per-user Claude config. Holds top-level (user-scope) `mcpServers` and a
 * `projects[<path>].mcpServers` block for user-private project-bound servers.
 */
export function getUserClaudeJsonPath(): string {
  return join(homedir(), '.claude.json')
}

/** Project-scope MCP config (the version-controllable one). */
export function getProjectMcpJsonPath(projectPath: string): string {
  return join(projectPath, '.mcp.json')
}

export function getProjectsDir(): string {
  return join(getClaudeHome(), 'projects')
}

/**
 * Encode a project path to the directory name format Claude uses.
 * e.g. /Users/ruskin/Documents/projects/foo → -Users-ruskin-Documents-projects-foo
 */
export function encodeProjectPath(projectPath: string): string {
  return projectPath.replace(/\//g, '-')
}

/**
 * Decode a Claude project directory name back to a filesystem path.
 * e.g. -Users-ruskin-Documents-projects-foo → /Users/ruskin/Documents/projects/foo
 */
export function decodeProjectDirName(dirName: string): string {
  // The leading dash represents the root /
  return dirName.replace(/-/g, '/')
}

/**
 * Get the Claude data directory for a specific project.
 */
export function getProjectDataDir(projectPath: string): string {
  return join(getProjectsDir(), encodeProjectPath(projectPath))
}

/**
 * Get the memory directory for a specific project.
 */
export function getProjectMemoryPath(projectPath: string): string {
  return join(getProjectDataDir(projectPath), 'memory', 'MEMORY.md')
}

/**
 * Extract a display name from a project path.
 */
export function getProjectDisplayName(projectPath: string): string {
  return basename(projectPath)
}
