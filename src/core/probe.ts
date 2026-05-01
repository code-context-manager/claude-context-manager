import { basename, join, relative, resolve } from 'path'
import type { ProbeNode, ProbeNodeKind, ProbeResult, StaticLoadEntry } from './types'
import { estimateTokens } from './token-estimator'
import { parseSettingsJson, parseSkillFrontmatter } from './claude-parser'
import {
  getGlobalSettingsPath,
  getProjectMemoryPath,
} from './path-utils'
import { splitMemoryWindow } from './memory-window'
import { HOOK_BRANCH_CAP } from './constants'
import type { FsReader } from './fs'
import type { ClaudeCli } from './claude-cli'
import { computeFileStaticLoad, computeProjectStaticLoad } from './static-load'

/**
 * Assemble the Probe tree for a given target file inside a project.
 * See docs/decisions/0007 for the contract (certain vs. conditional).
 *
 * Now composes from the static-load primitives:
 *  - certain-on-load = project-static + file-static for the target
 *  - conditional     = MEMORY.md overflow, MCP schemas (children of mcp-index),
 *                      hooks, skills (these don't fire on file load alone)
 */
export async function probeFile(
  fs: FsReader,
  projectPath: string,
  targetPath: string,
  cli?: ClaudeCli,
): Promise<ProbeResult> {
  const absTarget = resolve(targetPath)
  const absProject = resolve(projectPath)

  const projStatic = await computeProjectStaticLoad(fs, absProject, cli)
  const fileStatic = await computeFileStaticLoad(fs, absProject, absTarget)

  const tree: ProbeNode[] = []
  for (const e of projStatic.entries) tree.push(staticEntryToNode(e, absProject, absTarget))
  for (const e of fileStatic.entries) tree.push(staticEntryToNode(e, absProject, absTarget))

  await attachMemoryOverflow(fs, absProject, tree)
  attachMcpSchemas(tree)
  await attachHooks(fs, absProject, tree)
  await attachSkills(fs, absProject, tree)

  let certainTokens = 0
  let conditionalTokens = 0
  const walk = (node: ProbeNode): void => {
    if (node.state === 'certain') certainTokens += node.tokens
    else conditionalTokens += node.tokens
    for (const child of node.children ?? []) walk(child)
  }
  tree.forEach(walk)

  return {
    targetPath: absTarget,
    projectPath: absProject,
    certainTokens,
    conditionalTokens,
    tree,
  }
}

const KIND_MAP: Record<StaticLoadEntry['kind'], ProbeNodeKind> = {
  'system-prompt': 'system-prompt',
  'env-info': 'env-info',
  'global-claude-md': 'global-claude-md',
  'project-claude-md': 'project-claude-md',
  'folder-claude-md': 'folder-claude-md',
  memory: 'memory',
  rule: 'rule',
  'mcp-index': 'mcp-index',
}

function staticEntryToNode(
  e: StaticLoadEntry,
  absProject: string,
  absTarget: string,
): ProbeNode {
  const node: ProbeNode = {
    id: probeIdFor(e),
    kind: KIND_MAP[e.kind],
    state: 'certain',
    label: e.label,
    tokens: e.tokens,
    note: e.note,
  }
  if (e.filePath) node.filePath = e.filePath
  // Triggers help the user understand WHY a node loads — recover the same
  // copy the previous probe.ts hand-wrote.
  if (e.kind === 'folder-claude-md' && e.triggeredBy) {
    node.trigger = `On path to target: ${relative(absProject, absTarget)}`
  } else if (e.kind === 'rule') {
    if (e.alwaysApply) {
      node.trigger = 'alwaysApply'
    } else if (e.pathGlobs) {
      const positive = e.pathGlobs.filter((g) => !g.trim().startsWith('!'))
      node.trigger = `matches: ${positive.join(', ')}`
    }
  } else if (e.kind === 'mcp-index') {
    node.trigger = 'Descriptions loaded at session start'
  }
  return node
}

function probeIdFor(e: StaticLoadEntry): string {
  if (e.kind === 'folder-claude-md' && e.filePath) return `folder-claude-md:${e.filePath}`
  if (e.kind === 'rule' && e.filePath) return `rule:${e.filePath}`
  if (e.kind === 'mcp-index' && e.filePath) return `mcp-index:${e.filePath}:${e.label}`
  return e.kind
}

/** Memory overflow becomes a conditional child of the memory node. */
async function attachMemoryOverflow(
  fs: FsReader,
  absProject: string,
  tree: ProbeNode[],
): Promise<void> {
  const memNode = tree.find((n) => n.kind === 'memory')
  if (!memNode) return
  const memoryPath = getProjectMemoryPath(absProject)
  const memory = await fs.readFile(memoryPath)
  if (!memory) return
  const split = splitMemoryWindow(memory)
  if (!split.hasOverflow) return
  memNode.children = [
    {
      id: 'memory-overflow',
      kind: 'memory',
      state: 'conditional',
      label: 'Overflow (past first 200 lines / 25KB)',
      tokens: estimateTokens(split.overflow),
      filePath: memoryPath,
      trigger: 'Not loaded — beyond Claude Code loading window',
    },
  ]
}

/**
 * MCP schemas hang off every mcp-index node as a conditional child. The
 * mcp-index nodes themselves are produced upstream by `computeProjectStaticLoad`
 * (which uses the shared discovery helper covering CLI + four config files);
 * here we just decorate each one with its conditional schema child.
 */
function attachMcpSchemas(tree: ProbeNode[]): void {
  for (const node of tree) {
    if (node.kind !== 'mcp-index') continue
    const sourceFile = node.filePath ?? ''
    const serverName = node.label.replace(/^MCP:\s*/, '')
    node.children = [
      {
        id: `mcp-schemas:${sourceFile}:${serverName}`,
        kind: 'mcp-schemas',
        state: 'conditional',
        label: 'Full tool schemas',
        tokens: 0,
        filePath: sourceFile || undefined,
        trigger: 'Loaded when Claude calls ToolSearch',
        note: 'Schema size unknown — fetched from server at runtime',
      },
    ]
  }
}

/**
 * Hooks are top-level conditional nodes. Hooks live in settings.json only
 * (not in `.mcp.json` or `~/.claude.json`'s projects map), so the two-path
 * scan here is correct as-is.
 */
async function attachHooks(
  fs: FsReader,
  absProject: string,
  tree: ProbeNode[],
): Promise<void> {
  const settingsPaths = [
    getGlobalSettingsPath(),
    join(absProject, '.claude', 'settings.json'),
  ]
  for (const sp of settingsPaths) {
    const raw = await fs.readFile(sp)
    if (!raw) continue
    const { hooks } = parseSettingsJson(raw)

    const visible = hooks.slice(0, HOOK_BRANCH_CAP)
    for (const hook of visible) {
      tree.push({
        id: `hook:${sp}:${hook.event}:${hook.matcher}:${hook.action}`,
        kind: 'hook',
        state: 'conditional',
        label: `Hook: ${hook.event}`,
        tokens: estimateTokens(hook.action),
        filePath: sp,
        trigger: `matcher: ${hook.matcher} — ${hook.action}`,
      })
    }
    if (hooks.length > HOOK_BRANCH_CAP) {
      tree.push({
        id: `hook-more:${sp}`,
        kind: 'more',
        state: 'conditional',
        label: `+${hooks.length - HOOK_BRANCH_CAP} more hooks`,
        tokens: 0,
        trigger: 'Expand for detail',
      })
    }
  }
}

/** Skills are always conditional — they fire on invocation, not on file load. */
async function attachSkills(
  fs: FsReader,
  absProject: string,
  tree: ProbeNode[],
): Promise<void> {
  const skillsDir = join(absProject, '.claude', 'skills')
  const skillEntries = await fs.readdir(skillsDir)
  if (!skillEntries) return
  for (const file of skillEntries.filter((f) => f.endsWith('.md'))) {
    const filePath = join(skillsDir, file)
    const content = await fs.readFile(filePath)
    if (!content) continue
    const { meta } = parseSkillFrontmatter(content)
    tree.push({
      id: `skill:${filePath}`,
      kind: 'skill',
      state: 'conditional',
      label: meta.name ?? basename(file, '.md'),
      tokens: estimateTokens(content),
      filePath,
      trigger: meta.trigger ?? meta.description ?? 'Loaded on skill invocation',
    })
  }
}
