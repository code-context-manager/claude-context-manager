import type { ReactNode } from 'react'

interface DetailSectionProps {
  /** Uppercase eyebrow above content. */
  title?: string
  /** Set on the last section to drop the bottom border. */
  last?: boolean
  children: ReactNode
}

/**
 * Standard padded block used in every detail drawer. Replaces the literal
 * `px-4 py-3 border-b border-edge` that was duplicated across detail views.
 */
export function DetailSection({ title, last, children }: DetailSectionProps) {
  return (
    <section className={`px-4 py-3${last ? '' : ' border-b border-edge'}`}>
      {title && (
        <div className="text-[10px] uppercase tracking-wider text-content-muted mb-2">{title}</div>
      )}
      {children}
    </section>
  )
}
