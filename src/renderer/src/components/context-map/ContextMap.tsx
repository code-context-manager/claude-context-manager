import { useMemo, useState } from 'react'
import type { ContextScope, ContextSource } from '../../../../core/types'
import { ContextType } from '../../../../core/types'
import { TreeRow } from '../common/TreeRow'
import { formatTokens } from '../common/format'

interface ContextMapProps {
  sources: ContextSource[]
  selectedPath: string | null
  onSelect: (source: ContextSource) => void
}

/** Slots we always render in the Project scope, even if empty. */
const PROJECT_TYPE_ORDER: ContextType[] = [
  ContextType.ProjectClaudeMd,
  ContextType.Rule,
  ContextType.Skill,
  ContextType.McpServer,
  ContextType.Memory,
]

/** Slots we always render in the Global scope, even if empty. */
const GLOBAL_TYPE_ORDER: ContextType[] = [
  ContextType.GlobalClaudeMd,
  ContextType.Skill,
  ContextType.McpServer,
]

const TYPE_LABELS: Record<ContextType, string> = {
  [ContextType.GlobalClaudeMd]: 'CLAUDE.md',
  [ContextType.ProjectClaudeMd]: 'CLAUDE.md',
  [ContextType.FolderClaudeMd]: 'Folders',
  [ContextType.Rule]: 'Rules',
  [ContextType.Skill]: 'Skills',
  [ContextType.Memory]: 'Memory',
  [ContextType.McpServer]: 'MCP Servers',
  [ContextType.Settings]: 'Settings',
}

const TYPE_DOT: Record<ContextType, string> = {
  [ContextType.GlobalClaudeMd]: 'bg-accent-blue',
  [ContextType.ProjectClaudeMd]: 'bg-blue-400',
  [ContextType.FolderClaudeMd]: 'bg-blue-300',
  [ContextType.Rule]: 'bg-accent-amber',
  [ContextType.Skill]: 'bg-accent-emerald',
  [ContextType.Memory]: 'bg-accent-purple',
  [ContextType.McpServer]: 'bg-accent-rose',
  [ContextType.Settings]: 'bg-content-muted',
}

function emptyHint(type: ContextType, scope: ContextScope): string {
  switch (type) {
    case ContextType.ProjectClaudeMd:
      return 'Add a CLAUDE.md to the project root.'
    case ContextType.GlobalClaudeMd:
      return 'Add ~/.claude/CLAUDE.md for instructions that apply everywhere.'
    case ContextType.Rule:
      return 'Add .md files to .claude/rules/.'
    case ContextType.Skill:
      return scope === 'global'
        ? 'Add skills to ~/.claude/skills/ to use them in every project.'
        : 'Add .md files to .claude/skills/.'
    case ContextType.McpServer:
      return scope === 'global'
        ? 'Configure MCP servers in ~/.claude/settings.json.'
        : 'Configure MCP servers in .claude/settings.json.'
    case ContextType.Memory:
      return 'Populated automatically when Claude saves to memory.'
    default:
      return ''
  }
}

interface Group {
  type: ContextType
  sources: ContextSource[]
  tokens: number
}

interface ScopeBlock {
  scope: ContextScope
  groups: Group[]
}

function buildScopeBlock(
  scope: ContextScope,
  order: ContextType[],
  bucket: Map<ContextType, ContextSource[]>,
): ScopeBlock {
  const groups: Group[] = order.map((type) => {
    const sources = bucket.get(type) ?? []
    return {
      type,
      sources,
      tokens: sources.reduce((sum, s) => sum + s.tokenEstimate, 0),
    }
  })
  // Folder CLAUDE.md is unusual; surface it only when present.
  const folderSources = bucket.get(ContextType.FolderClaudeMd)
  if (folderSources?.length) {
    groups.push({
      type: ContextType.FolderClaudeMd,
      sources: folderSources,
      tokens: folderSources.reduce((sum, s) => sum + s.tokenEstimate, 0),
    })
  }
  return { scope, groups }
}

export function ContextMap({ sources, selectedPath, onSelect }: ContextMapProps) {
  const { project, global } = useMemo(() => {
    const projectBucket = new Map<ContextType, ContextSource[]>()
    const globalBucket = new Map<ContextType, ContextSource[]>()
    for (const source of sources) {
      const bucket = source.scope === 'global' ? globalBucket : projectBucket
      const list = bucket.get(source.type) ?? []
      list.push(source)
      bucket.set(source.type, list)
    }
    return {
      project: buildScopeBlock('project', PROJECT_TYPE_ORDER, projectBucket),
      global: buildScopeBlock('global', GLOBAL_TYPE_ORDER, globalBucket),
    }
  }, [sources])

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div className="flex-1 overflow-y-auto text-xs font-mono">
      <ScopeGroups
        block={project}
        selectedPath={selectedPath}
        onSelect={onSelect}
        collapsed={collapsed}
        toggle={toggle}
      />
      <div className="mt-4">
        <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-content-muted">
          Global
        </div>
        <ScopeGroups
          block={global}
          selectedPath={selectedPath}
          onSelect={onSelect}
          collapsed={collapsed}
          toggle={toggle}
        />
      </div>
    </div>
  )
}

interface ScopeGroupsProps {
  block: ScopeBlock
  selectedPath: string | null
  onSelect: (source: ContextSource) => void
  collapsed: Set<string>
  toggle: (key: string) => void
}

function ScopeGroups({ block, selectedPath, onSelect, collapsed, toggle }: ScopeGroupsProps) {
  return (
    <>
      {block.groups.map((group) => {
        const key = `${block.scope}:${group.type}`
        const isEmpty = group.sources.length === 0
        const open = !collapsed.has(key)
        return (
          <div key={key}>
            <TreeRow
              depth={0}
              chevron={isEmpty ? 'none' : open ? 'open' : 'closed'}
              onClick={isEmpty ? undefined : () => toggle(key)}
              title={isEmpty ? emptyHint(group.type, block.scope) : undefined}
            >
              <span className={isEmpty ? 'text-content-muted/60' : 'text-content-secondary'}>
                {TYPE_LABELS[group.type]}
              </span>
              <span className="ml-auto flex items-center gap-2 text-[10px] text-content-muted tabular-nums">
                <span>{group.sources.length}</span>
                {group.tokens > 0 && <span>{formatTokens(group.tokens)}</span>}
              </span>
            </TreeRow>
            {open &&
              group.sources.map((source) => (
                <TreeRow
                  key={source.filePath + source.name}
                  depth={1}
                  chevron="none"
                  selected={selectedPath === source.filePath}
                  onClick={() => onSelect(source)}
                  title={source.filePath}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${TYPE_DOT[source.type]}`} />
                  <span className="text-content-primary truncate">{source.name}</span>
                  <span className="ml-auto text-[10px] text-content-muted tabular-nums">
                    {formatTokens(source.tokenEstimate)}
                  </span>
                </TreeRow>
              ))}
          </div>
        )
      })}
    </>
  )
}
