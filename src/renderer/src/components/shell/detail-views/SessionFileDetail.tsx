import { useState } from 'react'
import type { LoadReason, SessionTreeNode } from '../../../../../core/types'
import { useFileContent } from '../../../hooks/useFileContent'
import { FileOpenMenu } from '../../common/FileOpenMenu'
import { DetailHeader } from '../../common/DetailHeader'
import { DetailSection } from '../../common/DetailSection'

interface Props {
  node: SessionTreeNode
}

export function SessionFileDetail({ node }: Props) {
  const { content, loading } = useFileContent(node.path)
  const loaded = node.loaded

  return (
    <div className="flex flex-col">
      <DetailHeader eyebrow="File" title={node.name} subtitle={node.path} subtitleMono />

      {loaded && (
        <DetailSection title="Load">
          <Row label="Tokens loaded" value={`~${loaded.tokens}`} />
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
        {loading ? (
          <p className="text-xs text-content-muted">Loading…</p>
        ) : content ? (
          <pre className="text-xs text-content-secondary whitespace-pre-wrap font-mono leading-relaxed">
            {content.slice(0, 4000)}
            {content.length > 4000 && '\n\n…truncated…'}
          </pre>
        ) : (
          <p className="text-xs text-content-muted">Could not read file.</p>
        )}
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

function ReasonGroups({ reasons }: { reasons: LoadReason[] }) {
  const fileStatic: string[] = []
  const toolCalls: Record<ToolName, number[]> = { read: [], edit: [], write: [] }
  let hasSystem = false
  let hasProjectStatic = false
  let hasGlobalStatic = false

  for (const r of reasons) {
    switch (r.kind) {
      case 'file-static':
        fileStatic.push(r.triggeredBy)
        break
      case 'tool-call':
        toolCalls[r.tool].push(r.lineIndex)
        break
      case 'system':
        hasSystem = true
        break
      case 'project-static':
        hasProjectStatic = true
        break
      case 'global-static':
        hasGlobalStatic = true
        break
    }
  }

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
      {fileStatic.length > 0 && (
        <ExpandableGroup
          pill={
            <Pill cls="bg-fuchsia-500/20 text-fuchsia-700 dark:text-fuchsia-300">file-static</Pill>
          }
          summary={`pulled in by ${fileStatic.length} ${fileStatic.length === 1 ? 'file' : 'files'}`}
          items={fileStatic}
          mono
        />
      )}
      {hasProjectStatic && (
        <StaticRow
          pill={<Pill cls="bg-sky-500/20 text-sky-700 dark:text-sky-300">project-static</Pill>}
          text="auto-loaded for any session in this project"
        />
      )}
      {hasGlobalStatic && (
        <StaticRow
          pill={<Pill cls="bg-rose-500/20 text-rose-700 dark:text-rose-300">global-static</Pill>}
          text="auto-loaded for every session everywhere"
        />
      )}
      {hasSystem && (
        <StaticRow
          pill={<Pill cls="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">system</Pill>}
          text="synthetic Claude Code internal content"
        />
      )}
    </ul>
  )
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
  summary: string
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
