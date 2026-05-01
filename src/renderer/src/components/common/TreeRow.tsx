import type { ReactNode } from 'react'
import { Chevron } from './Chevron'

interface TreeRowProps {
  depth: number
  selected?: boolean
  /** 'open' / 'closed' for expandable rows; 'none' for leaves (renders a
   *  spacer so leaf rows still align with their expandable siblings). */
  chevron: 'open' | 'closed' | 'none'
  onClick?: () => void
  title?: string
  children: ReactNode
}

const PX_PER_DEPTH = 12
const BASE_PX = 8

/**
 * Indented row primitive shared by the project file picker and session tree.
 * Owns: indentation math, chevron slot, hover/selected styling. Doesn't own
 * the row body — consumers compose their own (badges, names, meta) inside.
 *
 * Not used by ProbeTree, which renders card-like rows by intent.
 */
export function TreeRow({ depth, selected, chevron, onClick, title, children }: TreeRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`w-full flex items-center gap-1.5 px-2 py-0.5 text-xs text-left transition-colors ${
        selected
          ? 'bg-surface-selected text-content-primary'
          : 'hover:bg-surface-hover text-content-secondary'
      }`}
      style={{ paddingLeft: `${depth * PX_PER_DEPTH + BASE_PX}px` }}
    >
      {chevron === 'none' ? (
        <span className="w-3 shrink-0" aria-hidden />
      ) : (
        <Chevron open={chevron === 'open'} size="sm" />
      )}
      {children}
    </button>
  )
}
