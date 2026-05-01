import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { OpenOption } from '../../env'

interface Props {
  filePath: string
}

let cachedOptions: OpenOption[] | null = null
let pendingFetch: Promise<OpenOption[]> | null = null

async function loadOptions(): Promise<OpenOption[]> {
  if (cachedOptions) return cachedOptions
  if (!pendingFetch) {
    pendingFetch = window.api.listOpenOptions().then((opts) => {
      cachedOptions = opts
      return opts
    })
  }
  return pendingFetch
}

export function FileOpenMenu({ filePath }: Props) {
  const [options, setOptions] = useState<OpenOption[]>(cachedOptions ?? [])
  const [menuOpen, setMenuOpen] = useState(false)
  const moreBtnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null)

  useEffect(() => {
    if (!options.length) {
      void loadOptions().then(setOptions)
    }
  }, [options.length])

  useLayoutEffect(() => {
    if (!menuOpen || !moreBtnRef.current) return
    const rect = moreBtnRef.current.getBoundingClientRect()
    setMenuPos({ top: rect.bottom + 4, left: rect.right - 220, width: 220 })
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node
      if (
        menuRef.current?.contains(target) ||
        moreBtnRef.current?.contains(target)
      ) {
        return
      }
      setMenuOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  async function handle(optionId: string) {
    setMenuOpen(false)
    const result = await window.api.openFileWith(filePath, optionId)
    if (!result.ok) {
      console.error(`[FileOpenMenu] open failed (${optionId}):`, result.error)
    }
  }

  if (!options.length) {
    return <div className="text-xs text-content-muted">Loading options…</div>
  }

  const primary = options.slice(0, 1)
  const overflow = options.slice(1)

  return (
    <div className="flex items-stretch gap-1.5">
      {primary.map((opt) => (
        <button
          key={opt.id}
          onClick={() => handle(opt.id)}
          className="flex-1 text-xs px-3 py-2 rounded-md bg-surface-raised hover:bg-surface-active text-content-secondary transition-colors truncate"
          title={opt.label}
        >
          {opt.label}
        </button>
      ))}
      {overflow.length > 0 && (
        <button
          ref={moreBtnRef}
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="text-xs px-2 py-2 rounded-md bg-surface-raised hover:bg-surface-active text-content-secondary transition-colors"
          title="More options"
        >
          ▾
        </button>
      )}
      {menuOpen &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, width: menuPos.width }}
            className="z-[1000] rounded-md border border-edge bg-surface-raised shadow-lg py-1"
          >
            {overflow.map((opt) => (
              <button
                key={opt.id}
                role="menuitem"
                onClick={() => handle(opt.id)}
                className="w-full text-left text-xs px-3 py-1.5 hover:bg-surface-active text-content-secondary"
              >
                {opt.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}
