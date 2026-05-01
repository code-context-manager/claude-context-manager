/**
 * Abstraction over the `claude` CLI. Lets `src/core/` ask Claude itself
 * "what MCP servers are configured here?" without spawning subprocesses
 * directly (Node-only) — adapters in `src/main/` provide the real impl.
 *
 * See docs/decisions/0011-mcp-discovery-cli-primary-fs-fallback.md.
 */

export type ClaudeMcpScope = 'project' | 'user' | 'local'

export interface ClaudeCliMcpServer {
  name: string
  /** Claude's scope for this server, when we can detect it from output. */
  scope?: ClaudeMcpScope
}

export interface ClaudeCli {
  /**
   * List MCP servers Claude itself knows about for the given project cwd.
   * Returns `null` if the CLI is unavailable, errored, or produced unparseable
   * output — callers should fall back to filesystem scanning in that case.
   */
  listMcpServers(projectPath: string): Promise<ClaudeCliMcpServer[] | null>
}

/**
 * Parse `claude mcp list` text output into server records.
 *
 * The output format isn't a documented contract, so this parser is permissive:
 *  - Section headers like "Project:", "User:", "Local:" set scope for the lines
 *    that follow.
 *  - Each subsequent non-empty line is treated as a server entry; the first
 *    `name`-like token (alphanumeric + `._-`, optionally trailed by `:`) becomes
 *    the server name.
 *  - Lines that don't match are skipped silently.
 *
 * If the format ever changes, update this — but the failure mode is graceful:
 * an empty parse returns `[]` and the caller treats it as "no servers
 * detected" rather than crashing.
 */
export function parseMcpListOutput(stdout: string): ClaudeCliMcpServer[] {
  const servers: ClaudeCliMcpServer[] = []
  let currentScope: ClaudeMcpScope | undefined

  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    const lower = line.toLowerCase()
    if (lower.startsWith('project') && line.endsWith(':')) {
      currentScope = 'project'
      continue
    }
    if (lower.startsWith('user') && line.endsWith(':')) {
      currentScope = 'user'
      continue
    }
    if (lower.startsWith('local') && line.endsWith(':')) {
      currentScope = 'local'
      continue
    }
    if (line.startsWith('#') || line.startsWith('-')) continue

    const match = line.match(/^([A-Za-z0-9_.-]+)\s*[:\s]/)
    const name = match?.[1] ?? line.match(/^([A-Za-z0-9_.-]+)$/)?.[1]
    if (!name) continue
    if (name.toLowerCase() === 'no') continue // "No MCP servers configured"

    servers.push(currentScope ? { name, scope: currentScope } : { name })
  }

  return servers
}
