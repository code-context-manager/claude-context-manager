import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { SessionSummary, UsageInfo } from '../../../../core/types'

interface Props {
  sessions: SessionSummary[]
  sessionId: string | null
  onSelect: (id: string) => void
  usage: UsageInfo | null
  model: string | null
  userMessages: number
  assistantTurns: number
  onRefresh: () => void
}

/**
 * Top bar: session chooser (defaults to most recent; dropdown for older) +
 * a context-size dot whose colour reflects how many tokens are loaded for
 * the next turn. No window-percentage — the window depends on a beta flag
 * that isn't recorded in the session JSONL, so any denominator we picked
 * would be a guess. Hover the dot for a per-category token breakdown plus
 * the user/assistant message counts read from the JSONL.
 */
export function SessionTopBar({
  sessions,
  sessionId,
  onSelect,
  usage,
  model,
  userMessages,
  assistantTurns,
  onRefresh,
}: Props) {
  const total = usage
    ? usage.inputTokens +
      usage.cacheReadInputTokens +
      usage.cacheCreationInputTokens +
      usage.outputTokens
    : 0

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <label className="text-[10px] uppercase tracking-wider text-content-muted shrink-0">Session</label>
        <select
          value={sessionId ?? ''}
          onChange={(e) => onSelect(e.target.value)}
          className="text-xs bg-surface-raised border border-edge rounded px-2 py-1 text-content-primary min-w-0 flex-1 max-w-[480px] truncate"
        >
          {sessions.length === 0 && <option value="">No sessions</option>}
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {labelFor(s)}
            </option>
          ))}
        </select>
        <button
          onClick={onRefresh}
          title="Refresh session list and current snapshot"
          aria-label="Refresh"
          className="shrink-0 p-1 rounded text-content-muted hover:text-content-primary hover:bg-surface-hover transition-colors"
        >
          <RefreshCw className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>

      <ContextIndicator
        usage={usage}
        total={total}
        model={model}
        userMessages={userMessages}
        assistantTurns={assistantTurns}
      />
    </div>
  )
}

interface IndicatorProps {
  usage: UsageInfo | null
  total: number
  model: string | null
  userMessages: number
  assistantTurns: number
}

/** Absolute-token thresholds for the dot colour. These are starting
 *  guesses — tune once we have a few weeks of real sessions. The point is
 *  rough magnitude ("is this big?"), not precise budget tracking. */
const THRESHOLDS = {
  light: 100_000, // green below
  normal: 150_000, // blue below
  heavy: 400_000, // yellow below; red above
}

function ContextIndicator({ usage, total, model, userMessages, assistantTurns }: IndicatorProps) {
  const [open, setOpen] = useState(false)

  const band = bandFor(total)
  const dotClass =
    band === 'light'
      ? 'bg-green-500'
      : band === 'normal'
        ? 'bg-blue-500'
        : band === 'heavy'
          ? 'bg-yellow-500'
          : 'bg-red-500'

  return (
    <div
      className="shrink-0 relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="flex items-center gap-2 px-2 py-1 rounded hover:bg-surface-hover transition-colors"
        aria-label="Session context size"
        aria-expanded={open}
      >
        <span className={`w-2.5 h-2.5 rounded-full ${dotClass}`} />
        <span className="text-xs font-mono text-content-secondary tabular-nums whitespace-nowrap">
          {formatTokens(total)}
        </span>
      </button>

      {open && usage && (
        <div className="absolute right-0 top-full mt-1 z-10 w-72 p-3 rounded-md border border-edge bg-surface-raised shadow-lg text-xs">
          <div className="font-mono text-content-primary mb-2">{model ?? 'unknown model'}</div>

          <div className="text-[10px] uppercase tracking-wider text-content-muted mb-1">
            Current context
          </div>
          <Row label="Input" value={usage.inputTokens} />
          <Row label="Cache write" value={usage.cacheCreationInputTokens} />
          <Row label="Cache read" value={usage.cacheReadInputTokens} />
          <Row label="Output" value={usage.outputTokens} />
          <div className="flex justify-between border-t border-edge mt-1 pt-1 font-medium text-content-primary">
            <span>Total</span>
            <span className="font-mono tabular-nums">{total.toLocaleString()}</span>
          </div>

          <div className="text-[10px] uppercase tracking-wider text-content-muted mt-3 mb-1">
            Messages
          </div>
          <Row label="User" value={userMessages} />
          <Row label="Assistant" value={assistantTurns} />
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-content-secondary">
      <span>{label}</span>
      <span className="font-mono tabular-nums">{value.toLocaleString()}</span>
    </div>
  )
}

function bandFor(total: number): 'light' | 'normal' | 'heavy' | 'very-heavy' {
  if (total < THRESHOLDS.light) return 'light'
  if (total < THRESHOLDS.normal) return 'normal'
  if (total < THRESHOLDS.heavy) return 'heavy'
  return 'very-heavy'
}

function labelFor(s: SessionSummary): string {
  const when = s.endedAt ? relTime(s.endedAt) : '?'
  const prompt = s.firstPrompt ?? '(no prompt)'
  return `${when} · ${prompt.length > 80 ? prompt.slice(0, 79) + '…' : prompt}`
}

function relTime(ts: number): string {
  const diff = Date.now() - ts
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString()
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}
