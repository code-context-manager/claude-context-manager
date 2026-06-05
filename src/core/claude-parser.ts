import type { RuleFrontmatter, SkillFrontmatter, McpServerConfig, HookConfig } from './types'

/**
 * Strip a single layer of matching surrounding quotes. Claude Code's docs
 * require glob patterns in `paths:` to be quoted in YAML (double-star globs
 * must be quoted), so the quotes are part of the literal text our minimal
 * parser sees — we must remove them or the glob never matches a real
 * (unquoted) path.
 */
function unquote(s: string): string {
  if (s.length >= 2) {
    const first = s[0]
    if ((first === '"' || first === "'") && s[s.length - 1] === first) {
      return s.slice(1, -1)
    }
  }
  return s
}

/**
 * Parse YAML-like frontmatter from a markdown file.
 * Returns the frontmatter as key-value pairs and the body content.
 */
export function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) {
    return { frontmatter: {}, body: content }
  }

  const rawFrontmatter = match[1]
  const body = match[2]
  const frontmatter: Record<string, unknown> = {}

  for (const line of rawFrontmatter.split('\n')) {
    // Handle list items under a key (e.g. paths:)
    if (line.startsWith('  - ') || line.startsWith('    - ')) {
      const lastKey = Object.keys(frontmatter).pop()
      if (lastKey) {
        const arr = frontmatter[lastKey]
        if (Array.isArray(arr)) {
          arr.push(unquote(line.replace(/^\s*-\s*/, '').trim()))
        }
      }
      continue
    }

    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue

    const key = line.slice(0, colonIdx).trim()
    const rawValue = line.slice(colonIdx + 1).trim()
    const value = unquote(rawValue)
    const quoted = value !== rawValue

    if (rawValue === '') {
      // Start of a list
      frontmatter[key] = []
    } else if (!quoted && value === 'true') {
      frontmatter[key] = true
    } else if (!quoted && value === 'false') {
      frontmatter[key] = false
    } else {
      frontmatter[key] = value
    }
  }

  return { frontmatter, body }
}

export function parseRuleFrontmatter(content: string): { meta: RuleFrontmatter; body: string } {
  const { frontmatter, body } = parseFrontmatter(content)
  return {
    meta: {
      description: frontmatter.description as string | undefined,
      paths: frontmatter.paths as string[] | undefined,
    },
    body,
  }
}

export function parseSkillFrontmatter(content: string): { meta: SkillFrontmatter; body: string } {
  const { frontmatter, body } = parseFrontmatter(content)
  return {
    meta: {
      name: frontmatter.name as string | undefined,
      description: frontmatter.description as string | undefined,
      trigger: frontmatter.trigger as string | undefined,
    },
    body,
  }
}

function extractMcpServers(value: unknown): McpServerConfig[] {
  if (!value || typeof value !== 'object') return []
  const out: McpServerConfig[] = []
  for (const [name, config] of Object.entries(value as Record<string, unknown>)) {
    const cfg = (config ?? {}) as Record<string, unknown>
    out.push({
      name,
      command: (cfg.command as string) ?? '',
      args: cfg.args as string[] | undefined,
      env: cfg.env as Record<string, string> | undefined,
      transport: cfg.type as string | undefined,
    })
  }
  return out
}

/**
 * Parse `~/.claude.json` and pull the MCP servers that apply to a given project.
 * Top-level `mcpServers` is user-scope (loads everywhere); the per-project block
 * is user-private but bound to one project.
 */
export function parseUserClaudeJson(
  content: string,
  projectPath: string,
): { userScopeMcp: McpServerConfig[]; projectScopeMcp: McpServerConfig[] } {
  try {
    const data = JSON.parse(content) as Record<string, unknown>
    const projects = (data.projects as Record<string, { mcpServers?: unknown }>) ?? {}
    return {
      userScopeMcp: extractMcpServers(data.mcpServers),
      projectScopeMcp: extractMcpServers(projects[projectPath]?.mcpServers),
    }
  } catch {
    return { userScopeMcp: [], projectScopeMcp: [] }
  }
}

export function parseSettingsJson(content: string): {
  mcpServers: McpServerConfig[]
  hooks: HookConfig[]
} {
  try {
    const settings = JSON.parse(content)
    const mcpServers = extractMcpServers(settings.mcpServers)
    const hooks: HookConfig[] = []

    // Hooks shape (Claude Code settings.json):
    //   { hooks: { <EventName>: [ { matcher, hooks: [{ type, command }] } ] } }
    const hookEntries = settings.hooks as Record<string, unknown> | undefined
    if (hookEntries && typeof hookEntries === 'object') {
      for (const [event, groups] of Object.entries(hookEntries)) {
        if (!Array.isArray(groups)) continue
        for (const group of groups as Array<Record<string, unknown>>) {
          const matcher = (group.matcher as string) ?? '*'
          const rawHooks = group.hooks as Array<Record<string, unknown>> | undefined
          if (!Array.isArray(rawHooks)) continue
          for (const h of rawHooks) {
            const type = (h.type as string) ?? 'command'
            const command = (h.command as string) ?? ''
            hooks.push({ event, matcher, action: `${type}: ${command}` })
          }
        }
      }
    }

    return { mcpServers, hooks }
  } catch {
    return { mcpServers: [], hooks: [] }
  }
}
