import type { ReactElement } from 'react'
import { BookOpen, Clock, Home, List, Search } from 'lucide-react'
import type { AppMode } from '../../../../core/types'

interface ModeSidebarProps {
  mode: AppMode
  onChange: (mode: AppMode) => void
}

interface ModeDef {
  id: AppMode
  label: string
  icon: ReactElement
  hint: string
}

const ICON_CLASS = 'w-5 h-5'
const ICON_STROKE = 1.75

const MODES: ModeDef[] = [
  {
    id: 'home',
    label: 'Home',
    hint: 'Overview of the three top-level functions',
    icon: <Home className={ICON_CLASS} strokeWidth={ICON_STROKE} />,
  },
  {
    id: 'inventory',
    label: 'Inventory',
    hint: 'What context exists in this project',
    icon: <List className={ICON_CLASS} strokeWidth={ICON_STROKE} />,
  },
  {
    id: 'probe',
    label: 'Probe',
    hint: 'Pick a file → what would load',
    icon: <Search className={ICON_CLASS} strokeWidth={ICON_STROKE} />,
  },
  {
    id: 'session',
    label: 'Session',
    hint: 'Past sessions — what did load',
    icon: <Clock className={ICON_CLASS} strokeWidth={ICON_STROKE} />,
  },
  {
    id: 'playbook',
    label: 'Playbook',
    hint: 'What context your repo could have',
    icon: <BookOpen className={ICON_CLASS} strokeWidth={ICON_STROKE} />,
  },
]

export function ModeSidebar({ mode, onChange }: ModeSidebarProps) {
  return (
    <nav className="w-14 shrink-0 border-r border-edge bg-surface-sidebar flex flex-col items-center py-3 gap-1">
      {MODES.map((m) => {
        const active = m.id === mode
        return (
          <button
            key={m.id}
            onClick={() => onChange(m.id)}
            title={`${m.label} — ${m.hint}`}
            className={`w-10 h-10 flex items-center justify-center rounded-md transition-colors ${
              active
                ? 'bg-surface-selected text-content-primary'
                : 'text-content-muted hover:bg-surface-hover hover:text-content-secondary'
            }`}
          >
            {m.icon}
          </button>
        )
      })}
    </nav>
  )
}
