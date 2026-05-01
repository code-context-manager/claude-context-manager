import { useState } from 'react'
import type { LoadReason, LoadVia, SessionTreeNode } from '../../../../../core/types'
import { useFileContent } from '../../../hooks/useFileContent'
import { FileOpenMenu } from '../../common/FileOpenMenu'
import { DetailSection } from '../../common/DetailSection'
import { FilePreview } from '../../common/FilePreview'

function fileBasename(p: string): string {
  const i = p.lastIndexOf('/')
  return i === -1 ? p : p.slice(i + 1)
}

interface Props {
  node: SessionTreeNode
}

export function SessionFileDetail({ node }: Props) {
  const { content, loading } = useFileContent(node.path)
  const loaded = node.loaded

  return (
    <div className="flex flex-col">
      {loaded && (loaded.readCount > 0 || loaded.editCount > 0 || loaded.writeCount > 0 || loaded.lastLoadedAt || node.staleSinceRead) && (
        <DetailSection title="Load">
          {loaded.readCount > 0 && <Row label="Reads" value={String(loaded.readCount)} />}
          {loaded.editCount > 0 && <Row label="Edits" value={String(loaded.editCount)} />}
          {loaded.writeCount > 0 && <Row label="Writes" value={String(loaded.writeCount)} />}
          {loaded.lastLoadedAt && (
            <Row label="Last loaded" value={new Date(loaded.lastLoadedAt).toLocaleString()} />
          )}
          {node.staleSinceRead && (
            <div className="mt-2 text-[11px] text-yellow-600 dark:text-yellow-400">
              ⚠ Changed on disk since Claude last read it.
            </div>
          )}
        </DetailSection>
      )}

      {loaded?.reasons && loaded.reasons.length > 0 && (
        <DetailSection title="Why is this loaded?">
          <ReasonGroups reasons={loaded.reasons} />
        </DetailSection>
      )}

      <DetailSection>
        <FileOpenMenu filePath={node.path} />
      </DetailSection>

      <DetailSection title="Current contents" last>
        <FilePreview filePath={node.path} content={content} loading={loading} />
      </DetailSection>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-xs py-0.5">
      <span className="text-content-muted">{label}</span>
      <span className="text-content-secondary font-mono truncate">{value}</span>
    </div>
  )
}

type ToolName = Extract<LoadReason, { kind: 'tool-call' }>['tool']

/**
 * Group reasons by the *rule or source* that pulled the file in, not just the
 * reason kind. A file-static load lists which rule (folder CLAUDE.md, path-
 * scoped rule, …) and what triggered the match — that's the link back to the
 * .md file the user actually wrote, which a flat list of triggering paths
 * doesn't surface.
 *
 * One static reason per (kind, via) pair; tool-calls stay grouped by verb.
 */
type StaticGroup = {
  kind: 'global-static' | 'project-static' | 'file-static'
  via: LoadVia
  /** Files that triggered this rule's match (file-static only). */
  triggers: string[]
}

function groupStatic(reasons: LoadReason[]): StaticGroup[] {
  const groups = new Map<string, StaticGroup>()
  for (const r of reasons) {
    if (r.kind !== 'file-static' && r.kind !== 'project-static' && r.kind !== 'global-static') continue
    const key = `${r.kind}::${viaKey(r.via)}`
    let g = groups.get(key)
    if (!g) {
      g = { kind: r.kind, via: r.via, triggers: [] }
      groups.set(key, g)
    }
    if (r.kind === 'file-static' && !g.triggers.includes(r.triggeredBy)) {
      g.triggers.push(r.triggeredBy)
    }
  }
  return Array.from(groups.values())
}

function viaKey(v: LoadVia): string {
  switch (v.kind) {
    case 'folder-claude-md':
      return `folder:${v.chainDir}`
    case 'rule-always-apply':
      return `always:${v.rulePath}`
    case 'rule-glob':
      return `rule:${v.rulePath}:${v.matchedGlob}`
    case 'mcp-index':
      return `mcp:${v.server}:${v.sourceFile}`
    default:
      return v.kind
  }
}

function ReasonGroups({ reasons }: { reasons: LoadReason[] }) {
  const toolCalls: Record<ToolName, number[]> = { read: [], edit: [], write: [] }
  let hasSystem = false
  for (const r of reasons) {
    if (r.kind === 'tool-call') toolCalls[r.tool].push(r.lineIndex)
    else if (r.kind === 'system') hasSystem = true
  }
  const staticGroups = groupStatic(reasons)

  return (
    <ul className="flex flex-col gap-1.5">
      {(['read', 'edit', 'write'] as const).map(tool =>
        toolCalls[tool].length > 0 ? (
          <ExpandableGroup
            key={tool}
            pill={<Pill cls="bg-blue-500/20 text-blue-700 dark:text-blue-300">{tool}</Pill>}
            summary={`${toolCalls[tool].length} ${toolCalls[tool].length === 1 ? 'call' : 'calls'}`}
            items={toolCalls[tool].map(line => `line ${line}`)}
          />
        ) : null,
      )}
      {staticGroups.map((g, i) => (
        <StaticGroupRow key={i} group={g} />
      ))}
      {hasSystem && (
        <StaticRow
          pill={<Pill cls="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">system</Pill>}
          text="synthetic Claude Code internal content"
        />
      )}
    </ul>
  )
}

function StaticGroupRow({ group }: { group: StaticGroup }) {
  const { pill, headline, sub } = describeGroup(group)
  // Only file-static groups have triggers worth listing; project/global rules
  // load unconditionally so a "matched files" list would be misleading.
  if (group.kind === 'file-static' && group.triggers.length > 0) {
    return (
      <ExpandableGroup
        pill={pill}
        summary={
          <>
            <span className="text-content-secondary">{headline}</span>
            {sub && <span className="text-content-muted"> · {sub}</span>}
            <span className="text-content-muted">
              {' '}
              · {group.triggers.length}{' '}
              {group.triggers.length === 1 ? 'file matched' : 'files matched'}
            </span>
          </>
        }
        items={group.triggers}
        mono
      />
    )
  }
  return (
    <li className="text-xs text-content-secondary leading-snug">
      {pill} <span>{headline}</span>
      {sub && <span className="text-content-muted"> · {sub}</span>}
    </li>
  )
}

function describeGroup(g: StaticGroup): {
  pill: React.ReactNode
  headline: React.ReactNode
  sub: React.ReactNode | null
} {
  const scopePill = (() => {
    if (g.kind === 'global-static')
      return <Pill cls="bg-rose-500/20 text-rose-700 dark:text-rose-300">global</Pill>
    if (g.kind === 'project-static')
      return <Pill cls="bg-sky-500/20 text-sky-700 dark:text-sky-300">project</Pill>
    return <Pill cls="bg-fuchsia-500/20 text-fuchsia-700 dark:text-fuchsia-300">file</Pill>
  })()

  switch (g.via.kind) {
    case 'global-claude-md':
      return { pill: scopePill, headline: '~/.claude/CLAUDE.md (global)', sub: null }
    case 'project-claude-md':
      return { pill: scopePill, headline: 'Project CLAUDE.md', sub: null }
    case 'folder-claude-md':
      return {
        pill: scopePill,
        headline: 'Folder CLAUDE.md',
        sub: <span className="font-mono">{g.via.chainDir}/CLAUDE.md</span>,
      }
    case 'memory':
      return { pill: scopePill, headline: 'MEMORY.md', sub: null }
    case 'rule-always-apply':
      return {
        pill: scopePill,
        headline: <>Rule (always-apply)</>,
        sub: <span className="font-mono">{fileBasename(g.via.rulePath)}</span>,
      }
    case 'rule-glob':
      return {
        pill: scopePill,
        headline: <>Rule</>,
        sub: (
          <>
            <span className="font-mono">{fileBasename(g.via.rulePath)}</span>{' '}
            matched <span className="font-mono">{g.via.matchedGlob}</span>
          </>
        ),
      }
    case 'mcp-index':
      return {
        pill: scopePill,
        headline: <>MCP server descriptions</>,
        sub: <span className="font-mono">{g.via.server}</span>,
      }
  }
}

function StaticRow({ pill, text }: { pill: React.ReactNode; text: string }) {
  return (
    <li className="text-xs text-content-secondary leading-snug">
      {pill} {text}
    </li>
  )
}

function ExpandableGroup({
  pill,
  summary,
  items,
  mono,
}: {
  pill: React.ReactNode
  summary: React.ReactNode
  items: string[]
  mono?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <li className="text-xs text-content-secondary leading-snug">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-left hover:text-content-primary"
      >
        <span
          className={`inline-block transition-transform text-content-muted ${open ? 'rotate-90' : ''}`}
        >
          ▸
        </span>
        {pill} <span>{summary}</span>
      </button>
      {open && (
        <ul className="mt-1 ml-4 flex flex-col gap-0.5">
          {items.map((item, i) => (
            <li
              key={i}
              className={`text-[10px] text-content-muted break-all ${mono ? 'font-mono' : ''}`}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function Pill({ cls, children }: { cls: string; children: React.ReactNode }) {
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cls}`}>{children}</span>
  )
}
