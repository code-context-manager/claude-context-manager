import { useCallback, useEffect, useRef } from 'react'

interface Props {
  onResize: (deltaX: number) => void
}

/**
 * Generic vertical column splitter. Emits pointer-x deltas; the caller
 * decides which column those deltas resize and how to clamp.
 *
 * For right-edge drawers with snap-to-close, use DetailSplitter instead.
 */
export function Splitter({ onResize }: Props) {
  const dragging = useRef(false)
  const lastX = useRef(0)

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragging.current = true
    lastX.current = e.clientX
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return
      const dx = e.clientX - lastX.current
      lastX.current = e.clientX
      if (dx !== 0) onResize(dx)
    },
    [onResize],
  )

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = false
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  useEffect(() => {
    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [])

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="shrink-0 w-1 -mx-0.5 z-10 cursor-col-resize hover:bg-accent/40 active:bg-accent/60 transition-colors"
    />
  )
}
