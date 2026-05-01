import { useMemo, useState } from 'react'
import type { ContextScope, ContextSource } from '../../../../core/types'
import { ContextType } from '../../../../core/types'
import { ContextItem } from './ContextItem'
import { Chevron } from '../common/Chevron'
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
  label: string
  totalTokens: number
  groups: Group[]
}

function buildScopeBlock(
  scope: ContextScope,
  label: string,
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
  return {
    scope,
    label,
    totalTokens: groups.reduce((sum, g) => sum + g.tokens, 0),
    groups,
  }
}

export function ContextMap({ sources, selectedPath, onSelect }: ContextMapProps) {
  const blocks = useMemo<ScopeBlock[]>(() => {
    const project = new Map<ContextType, ContextSource[]>()
    const global = new Map<ContextType, ContextSource[]>()
    for (const source of sources) {
      const bucket = source.scope === 'global' ? global : project
      const list = bucket.get(source.type) ?? []
      list.push(source)
      bucket.set(source.type, list)
    }
    return [
      buildScopeBlock('project', 'Project', PROJECT_TYPE_ORDER, project),
      buildScopeBlock('global', 'Global', GLOBAL_TYPE_ORDER, global),
    ]
  }, [sources])

  const [openScopes, setOpenScopes] = useState<Record<ContextScope, boolean>>({
    project: true,
    global: false,
  })
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const toggleScope = (scope: ContextScope) => {
    setOpenScopes((prev) => ({ ...prev, [scope]: !prev[scope] }))
  }

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <nav className="flex flex-col gap-2 p-3">
      {blocks.map((block) => {
        const open = openScopes[block.scope]
        return (
          <section
            key={block.scope}
            className="border border-edge rounded-lg overflow-hidden bg-surface-sidebar"
          >
            <button
              type="button"
              onClick={() => toggleScope(block.scope)}
              className="w-full px-3 py-2 flex items-center gap-2 hover:bg-surface-hover transition-colors"
            >
              <Chevron open={open} size="md" />
              <span className="text-xs font-medium uppercase tracking-wider text-content-primary flex-1 text-left">
                {block.label}
              </span>
              <span className="text-xs text-content-muted">
                {formatTokens(block.totalTokens)} tok
              </span>
            </button>
            {open && (
              <div className="px-2 py-1.5 border-t border-edge flex flex-col gap-0.5">
                {block.groups.map((group) => {
                  const key = `${block.scope}:${group.type}`
                  const isEmpty = group.sources.length === 0
                  const groupOpen = !collapsedGroups.has(key)
                  return (
                    <div key={key}>
                      {isEmpty ? (
                        <div className="px-2 py-1 flex items-center gap-2">
                          <span className="w-3 h-3 shrink-0" />
                          <span className="text-xs font-medium text-content-muted/60 uppercase tracking-wider flex-1 text-left">
                            {TYPE_LABELS[group.type]} (0)
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleGroup(key)}
                          className="w-full px-2 py-1 flex items-center gap-2 hover:bg-surface-hover rounded-md transition-colors"
                        >
                          <Chevron open={groupOpen} size="sm" />
                          <span className="text-xs font-medium text-content-muted uppercase tracking-wider flex-1 text-left">
                            {TYPE_LABELS[group.type]} ({group.sources.length})
                          </span>
                          <span className="text-xs text-content-muted">
                            ~{group.tokens.toLocaleString()}t
                          </span>
                        </button>
                      )}
                      {isEmpty ? (
                        <p className="ml-5 mr-2 mb-1 text-xs text-content-muted/60 italic">
                          {emptyHint(group.type, block.scope)}
                        </p>
                      ) : (
                        groupOpen && (
                          <div className="flex flex-col gap-0.5 ml-3 mt-0.5 mb-1">
                            {group.sources.map((source) => (
                              <ContextItem
                                key={source.filePath + source.name}
                                source={source}
                                selected={selectedPath === source.filePath}
                                onSelect={() => onSelect(source)}
                              />
                            ))}
                          </div>
                        )
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )
      })}
    </nav>
  )
}

