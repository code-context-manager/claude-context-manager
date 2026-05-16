import { useState } from 'react'
import type { LoadedContextSnapshot, LoadReason, SessionTree, SessionTreeNode } from '../../../../core/types'
import type { NonFsSectionKind } from '../../store'
import { TreeRow } from '../common/TreeRow'
import { formatTokens } from '../common/format'
import { NonFsTreeGroup } from './NonFsTreeGroup'

interface Props {
  tree: SessionTree
  snapshot: LoadedContextSnapshot
  worktree: string | null
  selectedPath: string | null
  selectedNonFs: NonFsSectionKind | null
  onSelect: (node: SessionTreeNode) => void
  onSelectNonFs: (section: NonFsSectionKind) => void
}

export function SessionFileTree({
  tree,
  snapshot,
  worktree,
  selectedPath,
  selectedNonFs,
  onSelect,
  onSelectNonFs,
}: Props) {
  return (
    <div className="flex-1 overflow-y-auto text-xs font-mono">
      {worktree && (
        <div className="px-3 py-1 text-[10px] text-content-muted">
          worktree: {worktree}
        </div>
      )}
      <TreeNode node={tree.projectRoot} depth={0} selectedPath={selectedPath} onSelect={onSelect} defaultOpen />
      {tree.externalRoots.length > 0 && (
        <div className="mt-4">
          <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-content-muted">External reads</div>
          {tree.externalRoots.map((root) => (
            <TreeNode
              key={root.path}
              node={root}
              depth={0}
              selectedPath={selectedPath}
              onSelect={onSelect}
              defaultOpen
            />
          ))}
        </div>
      )}
      <div className="mt-4">
        <NonFsTreeGroup snapshot={snapshot} selected={selectedNonFs} onSelect={onSelectNonFs} />
      </div>
    </div>
  )
}

interface NodeProps {
  node: SessionTreeNode
  depth: number
  selectedPath: string | null
  onSelect: (node: SessionTreeNode) => void
  defaultOpen?: boolean
}

function TreeNode({ node, depth, selectedPath, onSelect, defaultOpen }: NodeProps) {
  const hasLoadedDescendant = node.loadedCountRollup > 0
  const [open, setOpen] = useState(defaultOpen ?? (depth < 2 || hasLoadedDescendant))

  if (node.isDirectory) {
    // Collapse chains of single-child directories into one row, e.g.
    // `projects/<encoded>/memory/` becomes a single label. Stops at the
    // first directory that has multiple visible children or contains a
    // file. Pure presentation — the underlying tree is unchanged.
    const { displayName, leaf } = collapseSingleChildChain(node)
    const children = leaf.children ?? []
    // Hide directories that contain nothing loaded to reduce noise at depth >0.
    if (depth > 0 && !hasLoadedDescendant) return null
    return (
      <div>
        <TreeRow
          depth={depth}
          chevron={open ? 'open' : 'closed'}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="text-content-secondary">{displayName}/</span>
          {hasLoadedDescendant && (
            <span className="ml-auto text-[10px] text-content-muted tabular-nums">
              {leaf.loadedCountRollup} · {formatTokens(leaf.loadedTokensRollup)}
            </span>
          )}
        </TreeRow>
        {open &&
          children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
      </div>
    )
  }

  // File
  if (!node.loaded) return null // only show touched files
  const isSelected = node.path === selectedPath
  const reasons = node.loaded.reasons ?? []
  const primary = primaryReason(reasons)
  return (
    <TreeRow
      depth={depth}
      selected={isSelected}
      chevron="none"
      onClick={() => onSelect(node)}
      title={`${node.path}\n\n${reasons.map(describeReason).join('\n')}`}
    >
      <ReasonBadge primary={primary} count={reasons.length} />
      <span className="text-content-primary truncate">{node.name}</span>
      {node.staleSinceRead && (
        <span
          className="text-[9px] px-1 rounded bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
          title="Changed on disk since Claude read it"
        >
          stale
        </span>
      )}
      <span className="ml-auto flex items-center gap-2 text-[10px] text-content-muted tabular-nums">
        {node.loaded.readCount > 1 && <span>×{node.loaded.readCount}</span>}
        <span>{formatTokens(node.loaded.tokens)}</span>
      </span>
    </TreeRow>
  )
}

/**
 * Walk down through directory nodes whose only visible child is another
 * directory, joining names with `/`. Returns the deepest directory in the
 * chain so its children become this row's children. A directory with a file
 * child or multiple children stops the collapse. Files in a child node still
 * render at +1 depth, which is the correct behaviour.
 */
function collapseSingleChildChain(start: SessionTreeNode): {
  displayName: string
  leaf: SessionTreeNode
} {
  let current = start
  let displayName = current.name
  while (true) {
    const children = current.children ?? []
    if (children.length !== 1) break
    const only = children[0]
    if (!only.isDirectory) break
    current = only
    displayName += '/' + current.name
  }
  return { displayName, leaf: current }
}

/**
 * Pick the most informative reason to surface as the badge. Tool-call wins
 * because action verbs (W/E/R) carry more signal than the static "would have
 * been loaded anyway" reasons. Within tool-call, write > edit > read.
 */
type PrimaryReasonKey = 'write' | 'edit' | 'read' | 'file-static' | 'project-static' | 'global-static' | 'system'

function primaryReason(reasons: LoadReason[]): PrimaryReasonKey {
  let toolCall: 'read' | 'edit' | null = null
  let hasFileStatic = false
  let hasProjectStatic = false
  let hasGlobalStatic = false
  let hasSystem = false
  for (const r of reasons) {
    if (r.kind === 'tool-call') {
      if (r.tool === 'write') return 'write'
      if (r.tool === 'edit') toolCall = 'edit'
      else if (toolCall === null) toolCall = 'read'
    } else if (r.kind === 'file-static') hasFileStatic = true
    else if (r.kind === 'project-static') hasProjectStatic = true
    else if (r.kind === 'global-static') hasGlobalStatic = true
    else if (r.kind === 'system') hasSystem = true
  }
  if (toolCall) return toolCall
  if (hasFileStatic) return 'file-static'
  if (hasProjectStatic) return 'project-static'
  if (hasGlobalStatic) return 'global-static'
  if (hasSystem) return 'system'
  return 'read'
}

function ReasonBadge({ primary, count }: { primary: PrimaryReasonKey; count: number }) {
  const map: Record<PrimaryReasonKey, { label: string; cls: string; title: string }> = {
    read: { label: 'R', cls: 'bg-blue-500/20 text-blue-600 dark:text-blue-400', title: 'Read by tool call' },
    edit: { label: 'E', cls: 'bg-amber-500/20 text-amber-600 dark:text-amber-400', title: 'Edited by tool call' },
    write: { label: 'W', cls: 'bg-purple-500/20 text-purple-600 dark:text-purple-400', title: 'Written by tool call' },
    'file-static': { label: 'F', cls: 'bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-400', title: 'Auto-loaded because another file in scope pulled it in' },
    'project-static': { label: 'P', cls: 'bg-sky-500/20 text-sky-600 dark:text-sky-400', title: 'Auto-loaded for any session in this project' },
    'global-static': { label: 'G', cls: 'bg-rose-500/20 text-rose-600 dark:text-rose-400', title: 'Auto-loaded globally' },
    system: { label: 'S', cls: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400', title: 'Synthetic system content' },
  }
  const { label, cls, title } = map[primary]
  return (
    <span className="flex items-center gap-0.5">
      <span className={`text-[9px] w-4 text-center rounded ${cls}`} title={title}>{label}</span>
      {count > 1 && (
        <span className="text-[9px] text-content-muted tabular-nums" title={`${count} reasons`}>
          +{count - 1}
        </span>
      )}
    </span>
  )
}

export function describeReason(r: LoadReason): string {
  switch (r.kind) {
    case 'tool-call':
      return `Tool call: ${r.tool} (line ${r.lineIndex})`
    case 'file-static':
      return `Pulled in by ${r.triggeredBy} — ${describeVia(r.via)}`
    case 'project-static':
      return `Project-wide — ${describeVia(r.via)}`
    case 'global-static':
      return `Global — ${describeVia(r.via)}`
    case 'system':
      return 'Synthetic system content'
  }
}

function describeVia(v: import('../../../../core/types').LoadVia): string {
  switch (v.kind) {
    case 'global-claude-md':
      return '~/.claude/CLAUDE.md'
    case 'project-claude-md':
      return 'project CLAUDE.md'
    case 'folder-claude-md':
      return `folder CLAUDE.md (${v.chainDir})`
    case 'memory':
      return 'MEMORY.md'
    case 'rule-always-apply':
      return `always-apply rule (${v.rulePath})`
    case 'rule-glob':
      return `rule ${v.rulePath} matched ${v.matchedGlob}`
    case 'mcp-index':
      return `MCP server ${v.server}`
  }
}

