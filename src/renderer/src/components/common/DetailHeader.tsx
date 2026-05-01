import type { ReactNode } from 'react'
import { DetailSection } from './DetailSection'

interface DetailHeaderProps {
  /** Short type/category label. */
  eyebrow: string
  /** Token estimate for the entry, rendered as "~N tokens" if set. */
  tokens?: number
  /** Optional badges shown alongside the eyebrow row (e.g. state + kind). */
  badges?: ReactNode
}

/**
 * Top header block for a detail drawer. The name/filename is intentionally
 * omitted — the surrounding tree already shows it.
 */
export function DetailHeader({ eyebrow, tokens, badges }: DetailHeaderProps) {
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
      {tokens !== undefined && (
        <div className="mt-2 text-xs text-content-muted">~{tokens.toLocaleString()} tokens</div>
      )}
    </DetailSection>
  )
}
