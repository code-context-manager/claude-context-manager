import type { ReactNode } from 'react'
import { useStore } from '../../store'
import { DetailDrawer } from './DetailDrawer'
import { DetailSplitter } from './DetailSplitter'
import { Splitter } from './Splitter'

interface ColumnSpec {
  node: ReactNode
  width: number
  onResize: (width: number) => void
  minWidth?: number
  maxWidth?: number
}

interface PageShellProps {
  title: string
  description?: ReactNode
  actions?: ReactNode
  /** Optional second header row (filter chips, session meta, etc). */
  toolbar?: ReactNode
  /** Optional left column (file picker, entry list, etc). */
  left?: ColumnSpec
  /** Optional middle column. If omitted, `main` is the only body column. */
  middle?: ColumnSpec
  /** Main column — always present. */
  main: ReactNode
  /**
   * Detail drawer content. When provided AND the global `detailOpen` flag is
   * true, PageShell renders the drawer + its splitter on the right. Pass
   * `null` for pages without a drawer (Home, etc).
   */
  detail?: ReactNode | null
}

/**
 * Unified page chrome: full-width header (title, description, actions,
 * optional toolbar) above a row of optional left / middle / main columns
 * and an optional right detail drawer. Splitters between columns.
 */
export function PageShell({
  title,
  description,
  actions,
  toolbar,
  left,
  middle,
  main,
  detail,
}: PageShellProps) {
  const detailOpen = useStore((s) => s.detailOpen)
  const detailWidth = useStore((s) => s.detailWidth)
  const setDetailOpen = useStore((s) => s.setDetailOpen)
  const setDetailWidth = useStore((s) => s.setDetailWidth)

  const showDrawer = detail != null && detailOpen

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0">
      <header className="shrink-0 border-b border-edge px-6 py-4 bg-surface-sidebar">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-sm font-medium text-content-primary">{title}</h1>
            {description && (
              <p className="text-xs text-content-muted mt-0.5">{description}</p>
            )}
          </div>
          {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
        </div>
        {toolbar && (
          <div className="mt-3 pt-3 border-t border-edge">{toolbar}</div>
        )}
      </header>

      <div className="flex-1 flex overflow-hidden min-w-0">
        {left && (
          <>
            <aside
              className="shrink-0 border-r border-edge bg-surface-sidebar flex flex-col overflow-hidden"
              style={{ width: left.width }}
            >
              {left.node}
            </aside>
            <Splitter onResize={(dx) => left.onResize(clamp(left.width + dx, left.minWidth ?? 200, left.maxWidth ?? 600))} />
          </>
        )}

        {middle && (
          <>
            <section
              className="shrink-0 flex flex-col overflow-hidden"
              style={{ width: middle.width }}
            >
              {middle.node}
            </section>
            <Splitter onResize={(dx) => middle.onResize(clamp(middle.width + dx, middle.minWidth ?? 240, middle.maxWidth ?? 1000))} />
          </>
        )}

        <main className="flex-1 flex flex-col overflow-hidden min-w-0">{main}</main>

        {showDrawer && (
          <>
            <DetailSplitter
              width={detailWidth}
              onChange={setDetailWidth}
              onSnapClosed={() => setDetailOpen(false)}
            />
            <div
              className="shrink-0 border-l border-edge bg-surface-sidebar overflow-hidden"
              style={{ width: detailWidth }}
            >
              {/*
                Pages typically pass <DetailDrawer selection={...} /> here.
                Kept as a generic ReactNode so Playbook (custom detail panel)
                can also use this slot.
              */}
              {detail}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

/**
 * Convenience wrapper — most pages render the standard DetailDrawer in the
 * detail slot. This pulls the per-mode selection from the store.
 */
export function PageDetailDrawer() {
  const selection = useStore((s) => s.detailSelections[s.mode] ?? null)
  return <DetailDrawer selection={selection} />
}
