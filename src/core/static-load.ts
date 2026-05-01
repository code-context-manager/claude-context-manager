import { basename, join, relative, resolve } from 'path'
import type { FsReader } from './fs'
import type { ClaudeCli } from './claude-cli'
import type { StaticLoadEntry, StaticLoadResult } from './types'
import { estimateTokens } from './token-estimator'
import {
  ENV_INFO_TOKENS,
  MCP_INDEX_TOKENS,
  SYSTEM_PROMPT_TOKENS,
} from './constants'
import { getGlobalClaudeMdPath, getProjectMemoryPath } from './path-utils'
import { parseRuleFrontmatter } from './claude-parser'
import { folderChain } from './folder-chain'
import { matchAnyGlob } from './glob-match'
import { splitMemoryWindow } from './memory-window'
import { discoverMcpServers } from './mcp-discovery'

/**
 * Project-wide static load: everything Claude Code injects into ANY session
 * in this project, before any tool calls fire. Pure function of disk state —
 * no JSONL involvement. The session view layers JSONL evidence on top.
 *
 * Includes synthetic items (system prompt, env info, mcp-index) with
 * estimated token counts since they have no parseable on-disk body.
 */
export async function computeProjectStaticLoad(
  fs: FsReader,
  projectPath: string,
  cli?: ClaudeCli,
): Promise<StaticLoadResult> {
  const absProject = resolve(projectPath)
  const entries: StaticLoadEntry[] = []

  entries.push({
    kind: 'system-prompt',
    scope: 'global',
    label: 'System prompt',
    tokens: SYSTEM_PROMPT_TOKENS,
    note: 'Claude Code internal — not on disk',
  })

  entries.push({
    kind: 'env-info',
    scope: 'project',
    label: 'Environment info',
    tokens: ENV_INFO_TOKENS,
    note: 'cwd, platform, model, git state',
  })

  const globalMdPath = getGlobalClaudeMdPath()
  const globalMd = await fs.readFile(globalMdPath)
  if (globalMd) {
    entries.push({
      kind: 'global-claude-md',
      scope: 'global',
      label: '~/.claude/CLAUDE.md',
      tokens: estimateTokens(globalMd),
      filePath: globalMdPath,
    })
  }

  const projectMdPath = join(absProject, 'CLAUDE.md')
  const projectMd = await fs.readFile(projectMdPath)
  if (projectMd) {
    entries.push({
      kind: 'project-claude-md',
      scope: 'project',
      label: 'Project CLAUDE.md',
      tokens: estimateTokens(projectMd),
      filePath: projectMdPath,
    })
  }

  const memoryPath = getProjectMemoryPath(absProject)
  const memory = await fs.readFile(memoryPath)
  if (memory) {
    const split = splitMemoryWindow(memory)
    entries.push({
      kind: 'memory',
      scope: 'project',
      label: 'MEMORY.md',
      tokens: estimateTokens(split.inWindow),
      filePath: memoryPath,
      note: split.hasOverflow
        ? `loaded window only — ${split.totalLines} lines, ${(split.totalBytes / 1024).toFixed(1)}KB total (overflow not loaded)`
        : `${split.totalLines} lines, ${(split.totalBytes / 1024).toFixed(1)}KB`,
    })
  }

  // Always-apply rules: these load for every session in the project.
  const rulesDir = join(absProject, '.claude', 'rules')
  const ruleEntries = await fs.readdir(rulesDir)
  if (ruleEntries) {
    for (const file of ruleEntries.filter((f) => f.endsWith('.md'))) {
      const rulePath = join(rulesDir, file)
      const content = await fs.readFile(rulePath)
      if (!content) continue
      const { meta } = parseRuleFrontmatter(content)
      if (meta.alwaysApply !== true) continue
      entries.push({
        kind: 'rule',
        scope: 'project',
        label: file,
        tokens: estimateTokens(content),
        filePath: rulePath,
        alwaysApply: true,
      })
    }
  }

  // MCP server index (descriptions only — full schemas are conditional).
  // Use the shared discovery helper so this view covers all four config
  // locations Claude Code resolves from (and the CLI when provided), in
  // lockstep with the inventory view. See ADR 0011.
  const mcpServers = await discoverMcpServers(fs, absProject, cli)
  for (const server of mcpServers) {
    entries.push({
      kind: 'mcp-index',
      scope: server.scope,
      label: `MCP: ${server.name}`,
      tokens: MCP_INDEX_TOKENS,
      filePath: server.sourceFile,
      note: 'Descriptions loaded at session start',
    })
  }

  return {
    projectPath: absProject,
    entries,
    totalTokens: entries.reduce((a, e) => a + e.tokens, 0),
  }
}

/**
 * Per-file static load: everything that loads BECAUSE a specific file is in
 * scope. Folder-chain CLAUDE.mds along the path from project root → file's
 * directory, plus path-scoped rules whose globs match the file's relative
 * path. Empty for files outside the project.
 *
 * Cheap; safe to call once per loaded file. The session-view builder
 * memoizes by directory across many calls in one build.
 */
export async function computeFileStaticLoad(
  fs: FsReader,
  projectPath: string,
  filePath: string,
): Promise<StaticLoadResult> {
  const absProject = resolve(projectPath)
  const absFile = resolve(filePath)
  const entries: StaticLoadEntry[] = []

  // Folder CLAUDE.mds along the chain (project root excluded — that's
  // project-static, not file-static).
  for (const dir of folderChain(absProject, absFile)) {
    const chainMd = join(dir, 'CLAUDE.md')
    const body = await fs.readFile(chainMd)
    if (!body) continue
    entries.push({
      kind: 'folder-claude-md',
      scope: 'file',
      label: `${relative(absProject, dir)}/CLAUDE.md`,
      tokens: estimateTokens(body),
      filePath: chainMd,
      triggeredBy: absFile,
    })
  }

  // Path-scoped rules whose globs match this file (excluding always-apply,
  // which is project-static, not file-static).
  const rulesDir = join(absProject, '.claude', 'rules')
  const ruleEntries = await fs.readdir(rulesDir)
  if (ruleEntries) {
    const relTarget = relative(absProject, absFile)
    for (const file of ruleEntries.filter((f) => f.endsWith('.md'))) {
      const rulePath = join(rulesDir, file)
      const content = await fs.readFile(rulePath)
      if (!content) continue
      const { meta } = parseRuleFrontmatter(content)
      if (meta.alwaysApply === true) continue
      const globs = meta.paths ?? []
      if (globs.length === 0) continue
      if (!matchAnyGlob(globs, relTarget)) continue
      entries.push({
        kind: 'rule',
        scope: 'file',
        label: basename(rulePath),
        tokens: estimateTokens(content),
        filePath: rulePath,
        pathGlobs: globs,
        triggeredBy: absFile,
      })
    }
  }

  return {
    projectPath: absProject,
    filePath: absFile,
    entries,
    totalTokens: entries.reduce((a, e) => a + e.tokens, 0),
  }
}
