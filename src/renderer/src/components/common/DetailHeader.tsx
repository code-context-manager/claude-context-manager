import type { ReactNode } from 'react'
import { DetailSection } from './DetailSection'

interface DetailHeaderProps {
  /** Short type/category label shown above the title. */
  eyebrow: string
  title: string
  /** Path or other secondary identifier shown beneath the title. */
  subtitle?: string
  /** Render the subtitle in a monospaced font (file paths, identifiers). */
  subtitleMono?: boolean
  /** Token estimate for the entry, rendered as "~N tokens" if set. */
  tokens?: number
  /** Optional badges shown alongside the eyebrow row (e.g. state + kind). */
  badges?: ReactNode
}

/**
 * Top header block for a detail drawer. Replaces the eyebrow + name + path +
 * tokens stack that was hand-rolled in every detail view.
 */
export function DetailHeader({
  eyebrow,
  title,
  subtitle,
  subtitleMono,
  tokens,
  badges,
}: DetailHeaderProps) {
  return (
    <DetailSection>
      {badges ? (
        <div className="flex items-center gap-2">
          {badges}
          <span className="text-[10px] uppercase tracking-wider text-content-muted">{eyebrow}</span>
        </div>
      ) : (
        <div className="text-[10px] uppercase tracking-wider text-content-muted">{eyebrow}</div>
      )}
      <div className="mt-1 text-sm font-medium text-content-primary break-all">{title}</div>
      {subtitle && (
        <div
          className={`mt-0.5 text-xs text-content-muted break-all ${subtitleMono ? 'font-mono' : ''}`}
        >
          {subtitle}
        </div>
      )}
      {tokens !== undefined && (
        <div className="mt-2 text-xs text-content-muted">~{tokens.toLocaleString()} tokens</div>
      )}
    </DetailSection>
  )
}
