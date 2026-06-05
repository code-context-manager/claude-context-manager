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
import {
  getGlobalClaudeMdPath,
  getProjectMemoryPath,
  getProjectFamilyBasePath,
} from './path-utils'
import { parseRuleFrontmatter } from './claude-parser'
import { folderChain } from './folder-chain'
import { firstMatchingGlob } from './glob-match'
import { splitMemoryWindow } from './memory-window'
import { discoverMcpServers } from './mcp-discovery'
import { listAllRulesForProject } from './rules'
import { resolveClaudeMdImports } from './imports'

/**
 * Expand a CLAUDE.md's `@path` imports and push one entry per imported file.
 * Imported files load into context at launch alongside their importer, so
 * their tokens belong in the same budget. Imports inherit the importer's
 * scope; for folder-chain (file-static) CLAUDE.mds they carry `triggeredBy`.
 */
async function pushClaudeMdImports(
  fs: FsReader,
  entries: StaticLoadEntry[],
  body: string,
  containingFile: string,
  scope: StaticLoadEntry['scope'],
  triggeredBy?: string,
): Promise<void> {
  for (const imp of await resolveClaudeMdImports(fs, body, containingFile)) {
    entries.push({
      kind: 'claude-md-import',
      scope,
      label: basename(imp.filePath),
      tokens: imp.tokens,
      filePath: imp.filePath,
      triggeredBy,
      note: `@import from ${basename(imp.importedBy)}`,
      via: {
        kind: 'claude-md-import',
        importPath: imp.filePath,
        importedBy: imp.importedBy,
      },
    })
  }
}

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
      via: { kind: 'global-claude-md' },
    })
    await pushClaudeMdImports(fs, entries, globalMd, globalMdPath, 'global')
  }

  // Project instructions can live at `./CLAUDE.md` or `./.claude/CLAUDE.md`,
  // and a gitignored `./CLAUDE.local.md` loads alongside them. Claude Code
  // loads each that exists.
  const projectMdCandidates: Array<{ path: string; label: string }> = [
    { path: join(absProject, 'CLAUDE.md'), label: 'Project CLAUDE.md' },
    { path: join(absProject, '.claude', 'CLAUDE.md'), label: '.claude/CLAUDE.md' },
    { path: join(absProject, 'CLAUDE.local.md'), label: 'CLAUDE.local.md' },
  ]
  for (const cand of projectMdCandidates) {
    const body = await fs.readFile(cand.path)
    if (!body) continue
    entries.push({
      kind: 'project-claude-md',
      scope: 'project',
      label: cand.label,
      tokens: estimateTokens(body),
      filePath: cand.path,
      via: { kind: 'project-claude-md' },
    })
    await pushClaudeMdImports(fs, entries, body, cand.path, 'project')
  }

  // Memory is keyed to the project *family* base, not the cwd: Claude Code
  // stores a worktree session's MEMORY.md under the parent repo's project
  // dir, not the worktree's own. For a non-worktree path this is identity.
  const memoryPath = getProjectMemoryPath(getProjectFamilyBasePath(absProject))
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
      via: { kind: 'memory' },
    })
  }

  // Unconditional rules: a `.claude/rules/*.md` with no `paths` frontmatter
  // loads for every session, at the same precedence as `.claude/CLAUDE.md`.
  // User-scope rules (`~/.claude/rules/`) load everywhere; project-scope rules
  // load for this project. (Path-scoped rules are file-static — see below.)
  for (const ref of await listAllRulesForProject(fs, absProject)) {
    const content = await fs.readFile(ref.filePath)
    if (!content) continue
    const { meta } = parseRuleFrontmatter(content)
    if ((meta.paths ?? []).length > 0) continue
    entries.push({
      kind: 'rule',
      scope: ref.scope,
      label: basename(ref.filePath),
      tokens: estimateTokens(content),
      filePath: ref.filePath,
      unconditional: true,
      via: { kind: 'rule-unconditional', rulePath: ref.filePath },
    })
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
      via: { kind: 'mcp-index', server: server.name, sourceFile: server.sourceFile },
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

  // Folder CLAUDE.mds (and their CLAUDE.local.md siblings) along the chain
  // (project root excluded — that's project-static, not file-static).
  for (const dir of folderChain(absProject, absFile)) {
    for (const name of ['CLAUDE.md', 'CLAUDE.local.md']) {
      const chainMd = join(dir, name)
      const body = await fs.readFile(chainMd)
      if (!body) continue
      entries.push({
        kind: 'folder-claude-md',
        scope: 'file',
        label: `${relative(absProject, dir)}/${name}`,
        tokens: estimateTokens(body),
        filePath: chainMd,
        triggeredBy: absFile,
        via: { kind: 'folder-claude-md', chainDir: dir },
      })
      await pushClaudeMdImports(fs, entries, body, chainMd, 'file', absFile)
    }
  }

  // Path-scoped rules (`paths` frontmatter) whose globs match this file. Rules
  // with no `paths` are unconditional and so project-static, not file-static.
  // Both user-scope and project-scope rules are considered.
  const relTarget = relative(absProject, absFile)
  for (const ref of await listAllRulesForProject(fs, absProject)) {
    const content = await fs.readFile(ref.filePath)
    if (!content) continue
    const { meta } = parseRuleFrontmatter(content)
    const globs = meta.paths ?? []
    if (globs.length === 0) continue
    const matched = firstMatchingGlob(globs, relTarget)
    if (!matched) continue
    entries.push({
      kind: 'rule',
      scope: 'file',
      label: basename(ref.filePath),
      tokens: estimateTokens(content),
      filePath: ref.filePath,
      pathGlobs: globs,
      triggeredBy: absFile,
      via: { kind: 'rule-glob', rulePath: ref.filePath, matchedGlob: matched },
    })
  }

  return {
    projectPath: absProject,
    filePath: absFile,
    entries,
    totalTokens: entries.reduce((a, e) => a + e.tokens, 0),
  }
}
