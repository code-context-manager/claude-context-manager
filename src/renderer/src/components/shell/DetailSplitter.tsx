import { useCallback, useEffect, useRef } from 'react'

interface Props {
  width: number
  onChange: (width: number) => void
  onSnapClosed: () => void
  minWidth?: number
  maxWidth?: number
  snapThreshold?: number
}

export function DetailSplitter({
  width,
  onChange,
  onSnapClosed,
  minWidth = 280,
  maxWidth = 1200,
  snapThreshold = 150,
}: Props) {
  const dragging = useRef(false)

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragging.current = true
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return
      const next = window.innerWidth - e.clientX
      if (next < snapThreshold) {
        onSnapClosed()
        dragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        return
      }
      onChange(Math.max(minWidth, Math.min(maxWidth, next)))
    },
    [onChange, onSnapClosed, minWidth, maxWidth, snapThreshold],
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
      aria-valuenow={width}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="shrink-0 w-1 -mx-0.5 z-10 cursor-col-resize hover:bg-accent/40 active:bg-accent/60 transition-colors"
    />
  )
}
