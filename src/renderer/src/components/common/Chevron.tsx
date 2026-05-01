import { ChevronRight } from 'lucide-react'

interface ChevronProps {
  open: boolean
  size?: 'sm' | 'md'
}

/**
 * One canonical chevron for the whole app. Three trees and the inventory map
 * each had their own (some SVG, some unicode ▾▸); this is the rotation
 * version we now use everywhere.
 */
export function Chevron({ open, size = 'md' }: ChevronProps) {
  const cls = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'
  return (
    <ChevronRight
      className={`${cls} shrink-0 text-content-muted transition-transform ${open ? 'rotate-90' : ''}`}
      strokeWidth={2}
      aria-hidden
    />
  )
}
