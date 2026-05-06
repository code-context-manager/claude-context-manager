import { homedir } from 'os'
import { join, win32 as pathWin32, posix as pathPosix } from 'path'

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
 * Encode a project path to the directory name format Claude Code uses.
 *
 * Claude Code replaces each of `\`, `/`, `:`, `.` with `-`, so:
 *   /Users/me/.config/foo        → -Users-me--config-foo
 *   C:\Users\me\Documents        → C--Users-me-Documents
 *   C:\...\refurb-app\.claude\wt → C---refurb-app--claude-wt
 *
 * The encoding is many-to-one (lossy): both `\.` and `\\` map to `--`.
 * Inverting the encoding is therefore unreliable; prefer reading the real
 * path from session metadata (`cwd` field) when possible, and fall back to
 * `decodeProjectDirName` only when no session metadata is available.
 */
export function encodeProjectPath(projectPath: string): string {
  return projectPath.replace(/[\\/:.]/g, '-')
}

/**
 * Best-effort decode of a Claude project directory name back to a filesystem
 * path. Use this only as a fallback — `encodeProjectPath` is lossy, so the
 * result may not exactly match the original path (e.g. `\.claude` and
 * `\\claude` both encode to `--claude` and round-trip identically).
 *
 * Platform is inferred from the shape of the encoded name:
 * - `C--...`     → Windows (drive letter + '-' = the ':')
 * - `-Users-...` → POSIX (leading '-' = root '/')
 */
export function decodeProjectDirName(dirName: string): string {
  const winDrive = /^([A-Za-z])-(.*)$/.exec(dirName)
  if (winDrive) {
    // First '-' after the drive letter was ':'; rest were '\'.
    return winDrive[1] + ':' + winDrive[2].replace(/-/g, '\\')
  }
  return dirName.replace(/-/g, '/')
}

/** True if `p` looks like a Windows path (drive letter or backslash). */
function isWindowsPath(p: string): boolean {
  return /^[A-Za-z]:/.test(p) || p.includes('\\')
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
 * Extract a display name from a project path. Picks the right separator
 * conventions for the path's apparent platform so this works regardless of
 * the OS the app is currently running on.
 */
export function getProjectDisplayName(projectPath: string): string {
  const base = isWindowsPath(projectPath)
    ? pathWin32.basename(projectPath)
    : pathPosix.basename(projectPath)
  return base || projectPath
}
