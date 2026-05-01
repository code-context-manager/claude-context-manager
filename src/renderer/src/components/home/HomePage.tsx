import type { ReactElement } from 'react'
import { Clock, List, Search } from 'lucide-react'
import type { AppMode } from '../../../../core/types'
import { useStore } from '../../store'

/**
 * Home orients the user to the three top-level functions of the app.
 * Its only job is explanation — not dashboarding, not analytics.
 */
interface FeatureDef {
  id: Exclude<AppMode, 'home'>
  title: string
  tagline: string
  description: string
  icon: ReactElement
}

const FEATURES: FeatureDef[] = [
  {
    id: 'inventory',
    title: 'Inventory',
    tagline: 'What context exists?',
    description:
      'Browse every CLAUDE.md, rule, skill, MCP config, and memory file configured for this project. See where each instruction comes from and what it costs in tokens.',
    icon: <List className="w-7 h-7" strokeWidth={1.75} />,
  },
  {
    id: 'probe',
    title: 'Probe',
    tagline: 'What would load for this file?',
    description:
      'Pick any file in the project and see exactly which context sources Claude Code would pull in when working on it — folder-scoped CLAUDE.md, path-scoped rules, matching skills.',
    icon: <Search className="w-7 h-7" strokeWidth={1.75} />,
  },
  {
    id: 'session',
    title: 'Session',
    tagline: 'What did load?',
    description:
      'Open a past Claude Code session and inspect the exact context snapshot that was loaded — files read, system prompt, memory window, MCP schemas. The receipt for what already happened.',
    icon: <Clock className="w-7 h-7" strokeWidth={1.75} />,
  },
]

export function HomePage() {
  const setMode = useStore((s) => s.setMode)
  const currentProject = useStore((s) => s.currentProject)

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-8 py-12">
        <header className="mb-10">
          <h1 className="text-2xl font-semibold text-content-primary">Claude Context Manager</h1>
          <p className="mt-2 text-sm text-content-muted max-w-2xl">
            See what context Claude Code is loading for your project — auditable, diffable, and curatable.
            Pick one of the three views below to get started.
          </p>
          {currentProject && (
            <p className="mt-3 text-xs text-content-muted">
              Active project: <span className="font-mono text-content-secondary">{currentProject}</span>
            </p>
          )}
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <button
              key={f.id}
              onClick={() => setMode(f.id)}
              className="text-left p-6 rounded-lg border border-edge bg-surface-sidebar hover:bg-surface-hover hover:border-content-muted transition-colors flex flex-col gap-3 min-h-[220px]"
            >
              <div className="text-content-secondary">{f.icon}</div>
              <div>
                <h2 className="text-base font-medium text-content-primary">{f.title}</h2>
                <p className="text-xs text-content-muted mt-0.5">{f.tagline}</p>
              </div>
              <p className="text-sm text-content-secondary leading-relaxed">{f.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
