import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Folder, Sun, Moon, Monitor } from 'lucide-react'
import type { Project } from '../../../../core/types'
import { useStore } from '../../store'
import { useTheme, type ThemeMode } from '../../hooks/useTheme'

interface HeaderBarProps {
  currentProject: string | null
  onSwitchProject: (projectPath: string) => void
}

/**
 * Top draggable title bar with the active project selector. Project selection
 * lives here because Inventory/Probe/Session all scope to the active project
 * atomically.
 */
export function HeaderBar({ currentProject, onSwitchProject }: HeaderBarProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.api.getProjects().then(setProjects)
  }, [])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const currentName = currentProject ? basename(currentProject) : 'No project'

  return (
    <div
      className="h-10 shrink-0 flex items-center justify-between px-3 border-b border-edge bg-surface-sidebar"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left: spacer for macOS traffic lights */}
      <div className="w-16 shrink-0" />

      {/* Center: project selector */}
      <div
        className="relative flex-1 max-w-md"
        ref={dropdownRef}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-center gap-2 px-3 py-1 rounded-md hover:bg-surface-hover text-sm transition-colors"
        >
          <Folder className="w-4 h-4 shrink-0 text-content-muted" strokeWidth={1.75} />
          <span className="truncate font-medium">{currentName}</span>
          <ChevronDown
            className={`w-4 h-4 shrink-0 text-content-muted transition-transform ${open ? 'rotate-180' : ''}`}
            strokeWidth={2}
          />
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-md border border-edge-strong bg-surface-overlay shadow-overlay max-h-80 overflow-y-auto">
            {projects.length === 0 ? (
              <div className="px-3 py-2 text-xs text-content-muted">No projects found</div>
            ) : (
              projects.map((project) => (
                <button
                  key={project.path}
                  onClick={() => {
                    if (project.exists) {
                      onSwitchProject(project.path)
                      setOpen(false)
                    }
                  }}
                  disabled={!project.exists}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    project.path === currentProject
                      ? 'bg-surface-selected text-content-primary'
                      : project.exists
                        ? 'hover:bg-surface-hover text-content-secondary'
                        : 'text-content-disabled cursor-not-allowed'
                  }`}
                >
                  <div className="truncate font-medium">{project.name}</div>
                  <div className="truncate text-xs text-content-muted">{project.path}</div>
                  {project.lastUsed && (
                    <div className="text-xs text-content-disabled mt-0.5">
                      {formatRelativeTime(project.lastUsed)}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Right: theme toggle (also balances the macOS traffic-light spacer) */}
      <div
        className="w-16 shrink-0 flex items-center justify-end"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <ThemeToggle />
      </div>
    </div>
  )
}

function ThemeToggle() {
  const themeMode = useStore((s) => s.themeMode)
  const setThemeMode = useStore((s) => s.setThemeMode)
  const { setMode: setThemeCssMode } = useTheme()

  const order: ThemeMode[] = ['system', 'light', 'dark']
  const next = order[(order.indexOf(themeMode) + 1) % order.length]

  const Icon = themeMode === 'light' ? Sun : themeMode === 'dark' ? Moon : Monitor
  const label = `Theme: ${themeMode} (click for ${next})`

  return (
    <button
      onClick={() => {
        setThemeMode(next)
        setThemeCssMode(next)
      }}
      title={label}
      aria-label={label}
      className="p-1.5 rounded-md hover:bg-surface-hover text-content-muted hover:text-content-primary transition-colors"
    >
      <Icon className="w-4 h-4" strokeWidth={1.75} />
    </button>
  )
}

/** Cross-platform basename — strips the path up to the last `/` or `\`. */
function basename(p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  return i === -1 ? p : p.slice(i + 1)
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}
