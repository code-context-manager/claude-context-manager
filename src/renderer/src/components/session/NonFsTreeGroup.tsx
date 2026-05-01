import { useState } from 'react'
import type { LoadedContextSnapshot } from '../../../../core/types'
import type { NonFsSectionKind } from '../../store'
import { TreeRow } from '../common/TreeRow'
import { formatTokens } from '../common/format'

interface Props {
  snapshot: LoadedContextSnapshot
  selected: NonFsSectionKind | null
  onSelect: (section: NonFsSectionKind) => void
}

/**
 * Renders non-filesystem context (messages, system prompt, CLAUDE.md chain,
 * etc.) as a collapsible group at the top of the session tree, so everything
 * Claude has loaded sits in one scannable list.
 */
export function NonFsTreeGroup({ snapshot, selected, onSelect }: Props) {
  const [open, setOpen] = useState(true)

  const rows: Array<{ kind: NonFsSectionKind; label: string; detail: string; tokens?: number }> = [
    {
      kind: 'messages',
      label: 'Messages',
      detail: `${snapshot.messages.userCount} user · ${snapshot.messages.assistantCount} assistant`,
      tokens: snapshot.lastUsage?.inputTokens,
    },
    {
      kind: 'system-prompt',
      label: 'System prompt',
      detail: snapshot.systemPrompt ? 'Loaded' : 'Not captured',
      tokens: snapshot.systemPrompt?.tokens,
    },
    {
      kind: 'env-info',
      label: 'Environment info',
      detail: snapshot.envInfo ? 'Loaded' : 'Not captured',
      tokens: snapshot.envInfo?.tokens,
    },
    {
      kind: 'system-tools',
      label: 'System tools',
      detail: `${snapshot.systemTools.length} tool${snapshot.systemTools.length === 1 ? '' : 's'} invoked`,
    },
    {
      kind: 'memory',
      label: 'Memory',
      detail: snapshot.memory ? (snapshot.memory.path ?? 'MEMORY.md') : 'Not loaded',
      tokens: snapshot.memory?.tokens,
    },
    {
      kind: 'claude-md-chain',
      label: 'CLAUDE.md chain',
      detail: `${snapshot.claudeMdChain.length} file${snapshot.claudeMdChain.length === 1 ? '' : 's'}`,
      tokens: sumTokens(snapshot.claudeMdChain.map((c) => c.tokens)),
    },
    {
      kind: 'skills',
      label: 'Skills invoked',
      detail: `${snapshot.skillsInvoked.length} invocation${snapshot.skillsInvoked.length === 1 ? '' : 's'}`,
    },
    {
      kind: 'mcp-schemas',
      label: 'MCP tool schemas',
      detail: `${snapshot.mcpSchemaFetches.length} fetch${snapshot.mcpSchemaFetches.length === 1 ? '' : 'es'}`,
    },
  ]

  const totalTokens = rows.reduce((a, r) => a + (r.tokens ?? 0), 0)

  return (
    <div className="border-b border-edge">
      <TreeRow
        depth={0}
        chevron={open ? 'open' : 'closed'}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-content-secondary">Other context</span>
        <span className="ml-auto text-[10px] text-content-muted tabular-nums">
          {rows.length} · {formatTokens(totalTokens)}
        </span>
      </TreeRow>
      {open &&
        rows.map((row) => {
          const active = selected === row.kind
          return (
            <TreeRow
              key={row.kind}
              depth={1}
              chevron="none"
              selected={active}
              onClick={() => onSelect(row.kind)}
              title={row.detail}
            >
              <span className="text-content-primary truncate">{row.label}</span>
              <span className="text-[10px] text-content-muted truncate">{row.detail}</span>
              {row.tokens !== undefined && row.tokens > 0 && (
                <span className="ml-auto text-[10px] text-content-muted tabular-nums">
                  {formatTokens(row.tokens)}
                </span>
              )}
            </TreeRow>
          )
        })}
    </div>
  )
}

function sumTokens(ns: number[]): number {
  return ns.reduce((a, b) => a + b, 0)
}
