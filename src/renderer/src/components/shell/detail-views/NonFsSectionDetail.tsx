import type { LoadedContextSnapshot } from '../../../../../core/types'
import type { NonFsSectionKind } from '../../../store'
import { DetailHeader } from '../../common/DetailHeader'
import { DetailSection } from '../../common/DetailSection'

interface Props {
  section: NonFsSectionKind
  snapshot: LoadedContextSnapshot
}

export function NonFsSectionDetail({ section, snapshot }: Props) {
  return (
    <div className="flex flex-col">
      <DetailHeader eyebrow={labelFor(section)} />
      <DetailSection last>
        <div className="text-xs text-content-secondary">
          {section === 'messages' && <Messages snapshot={snapshot} />}
          {section === 'system-prompt' && <Simple text={snapshot.systemPrompt ? `${snapshot.systemPrompt.tokens} tokens` : 'Not captured in this JSONL.'} />}
          {section === 'env-info' && <Simple text={snapshot.envInfo ? `${snapshot.envInfo.tokens} tokens` : 'Not captured in this JSONL.'} />}
          {section === 'system-tools' && <ToolList names={snapshot.systemTools} />}
          {section === 'claude-md-chain' && <ClaudeMd snapshot={snapshot} />}
          {section === 'skills' && <Skills snapshot={snapshot} />}
          {section === 'mcp-schemas' && <McpSchemas snapshot={snapshot} />}
        </div>
      </DetailSection>
    </div>
  )
}

function labelFor(k: NonFsSectionKind): string {
  return (
    {
      messages: 'Messages',
      'system-prompt': 'System prompt',
      'env-info': 'Environment info',
      'system-tools': 'System tools',
      'claude-md-chain': 'CLAUDE.md chain',
      skills: 'Skills invoked',
      'mcp-schemas': 'MCP tool schemas',
    } as const
  )[k]
}

function Simple({ text }: { text: string }) {
  return <p>{text}</p>
}

function Messages({ snapshot }: { snapshot: LoadedContextSnapshot }) {
  const u = snapshot.lastUsage
  return (
    <div className="space-y-1">
      <Row label="User messages" value={String(snapshot.messages.userCount)} />
      <Row label="Assistant messages" value={String(snapshot.messages.assistantCount)} />
      {u && (
        <>
          <Row label="Input tokens" value={String(u.inputTokens)} />
          <Row label="Output tokens" value={String(u.outputTokens)} />
          <Row label="Cache read" value={String(u.cacheReadInputTokens)} />
          <Row label="Cache creation" value={String(u.cacheCreationInputTokens)} />
        </>
      )}
    </div>
  )
}

function ToolList({ names }: { names: string[] }) {
  if (names.length === 0) return <p className="text-content-muted">None.</p>
  return (
    <ul className="flex flex-wrap gap-1">
      {names.map((n) => (
        <li key={n} className="text-[11px] px-2 py-0.5 rounded bg-surface-raised font-mono">
          {n}
        </li>
      ))}
    </ul>
  )
}

function ClaudeMd({ snapshot }: { snapshot: LoadedContextSnapshot }) {
  if (snapshot.claudeMdChain.length === 0) return <p className="text-content-muted">None loaded.</p>
  return (
    <ul className="space-y-1">
      {snapshot.claudeMdChain.map((c) => (
        <li key={c.path} className="flex justify-between gap-2 font-mono text-[11px]">
          <span className="truncate" title={c.path}>{c.path}</span>
          <span className="text-content-muted tabular-nums">{c.tokens}</span>
        </li>
      ))}
    </ul>
  )
}

function Skills({ snapshot }: { snapshot: LoadedContextSnapshot }) {
  if (snapshot.skillsInvoked.length === 0) return <p className="text-content-muted">None.</p>
  return (
    <ul className="space-y-1">
      {snapshot.skillsInvoked.map((s, i) => (
        <li key={`${s.name}-${i}`} className="font-mono text-[11px]">
          {s.name}
          {s.filePath && <span className="text-content-muted"> — {s.filePath}</span>}
        </li>
      ))}
    </ul>
  )
}

function McpSchemas({ snapshot }: { snapshot: LoadedContextSnapshot }) {
  if (snapshot.mcpSchemaFetches.length === 0) return <p className="text-content-muted">None.</p>
  return (
    <ul className="space-y-1">
      {snapshot.mcpSchemaFetches.map((m, i) => (
        <li key={i} className="font-mono text-[11px]">
          {m.query}
        </li>
      ))}
    </ul>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-content-muted">{label}</span>
      <span className="text-content-secondary font-mono tabular-nums">{value}</span>
    </div>
  )
}
