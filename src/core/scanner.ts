import { basename, join, relative } from 'path'
import { ContextType, type ContextSource } from './types'
import { estimateTokens } from './token-estimator'
import { parseRuleFrontmatter, parseSkillFrontmatter } from './claude-parser'
import {
  getGlobalClaudeMdPath,
  getProjectMemoryPath,
} from './path-utils'
import type { FsReader } from './fs'
import type { ClaudeCli } from './claude-cli'
import { discoverMcpServers } from './mcp-discovery'
import { listAllSkillsForProject } from './skills'
import { listAllRulesForProject } from './rules'

/**
 * Scan all context sources for a given project directory.
 *
 * MCP discovery uses `cli` as the primary source when available — it's
 * Claude's own resolver, so it covers bundled/plugin servers we can't see
 * from the filesystem. We fall back to scanning JSON config files only when
 * the CLI is absent or returns null. See
 * docs/decisions/0011-mcp-discovery-cli-primary-fs-fallback.md.
 */
export async function scanProject(
  fs: FsReader,
  projectPath: string,
  cli?: ClaudeCli,
): Promise<ContextSource[]> {
  const sources: ContextSource[] = []

  // Global CLAUDE.md
  const globalMdPath = getGlobalClaudeMdPath()
  const globalMd = await fs.readFile(globalMdPath)
  if (globalMd) {
    sources.push({
      type: ContextType.GlobalClaudeMd,
      scope: 'global',
      name: 'Global CLAUDE.md',
      filePath: globalMdPath,
      tokenEstimate: estimateTokens(globalMd),
    })
  }

  // Project CLAUDE.md — `./CLAUDE.md`, `./.claude/CLAUDE.md`, and the
  // gitignored `./CLAUDE.local.md` all load when present.
  for (const cand of [
    { path: join(projectPath, 'CLAUDE.md'), name: 'Project CLAUDE.md' },
    { path: join(projectPath, '.claude', 'CLAUDE.md'), name: '.claude/CLAUDE.md' },
    { path: join(projectPath, 'CLAUDE.local.md'), name: 'CLAUDE.local.md' },
  ]) {
    const body = await fs.readFile(cand.path)
    if (!body) continue
    sources.push({
      type: ContextType.ProjectClaudeMd,
      scope: 'project',
      name: cand.name,
      filePath: cand.path,
      tokenEstimate: estimateTokens(body),
    })
  }

  // Folder-level CLAUDE.md files (one level deep for now)
  await scanFolderClaudeMd(fs, projectPath, projectPath, sources)

  // Rules — user-scope (`~/.claude/rules/`) and project-scope, discovered
  // recursively. A rule with no `paths` is unconditional (loads every session);
  // one with `paths` is path-scoped.
  for (const ref of await listAllRulesForProject(fs, projectPath)) {
    const content = await fs.readFile(ref.filePath)
    if (!content) continue
    const { meta } = parseRuleFrontmatter(content)
    const globs = meta.paths ?? []
    sources.push({
      type: ContextType.Rule,
      scope: ref.scope,
      name: basename(ref.filePath),
      filePath: ref.filePath,
      tokenEstimate: estimateTokens(content),
      pathGlobs: globs.length > 0 ? globs : undefined,
      unconditional: globs.length === 0 ? true : undefined,
      description: meta.description,
    })
  }

  // Skills (project + global)
  for (const skill of await listAllSkillsForProject(fs, projectPath)) {
    const content = await fs.readFile(skill.filePath)
    if (!content) continue
    const { meta } = parseSkillFrontmatter(content)
    sources.push({
      type: ContextType.Skill,
      scope: skill.scope,
      name: meta.name ?? skill.displayName.replace(/\.md$/, ''),
      filePath: skill.filePath,
      tokenEstimate: estimateTokens(content),
      description: meta.description,
    })
  }

  // Memory
  const memoryPath = getProjectMemoryPath(projectPath)
  const memory = await fs.readFile(memoryPath)
  if (memory) {
    sources.push({
      type: ContextType.Memory,
      scope: 'project',
      name: 'MEMORY.md',
      filePath: memoryPath,
      tokenEstimate: estimateTokens(memory),
    })
  }

  // MCP servers — single discovery helper handles CLI-primary / FS-fallback.
  const mcpServers = await discoverMcpServers(fs, projectPath, cli)
  for (const m of mcpServers) {
    sources.push({
      type: ContextType.McpServer,
      scope: m.scope,
      name: m.name,
      filePath: m.sourceFile,
      tokenEstimate: 120,
      mcp: {
        transport: m.config?.transport,
        command: m.config?.command || undefined,
        args: m.config?.args,
        envKeys: m.config?.env ? Object.keys(m.config.env) : undefined,
        sourceFile: m.sourceFile,
        claudeScope: m.claudeScope,
      },
    })
  }

  return sources
}

async function scanFolderClaudeMd(
  fs: FsReader,
  baseDir: string,
  currentDir: string,
  sources: ContextSource[],
  depth = 0,
): Promise<void> {
  if (depth > 2) return

  const entries = await fs.readdirWithTypes(currentDir)
  if (!entries) return

  for (const entry of entries) {
    if (!entry.isDirectory) continue
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue

    const subdir = join(currentDir, entry.name)
    const claudeMdPath = join(subdir, 'CLAUDE.md')
    const content = await fs.readFile(claudeMdPath)
    if (content) {
      sources.push({
        type: ContextType.FolderClaudeMd,
        scope: 'project',
        name: `${relative(baseDir, subdir)}/CLAUDE.md`,
        filePath: claudeMdPath,
        tokenEstimate: estimateTokens(content),
        scopePath: subdir,
      })
    }

    await scanFolderClaudeMd(fs, baseDir, subdir, sources, depth + 1)
  }
}
