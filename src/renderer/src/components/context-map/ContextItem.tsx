import type { ContextSource } from '../../../../core/types'
import { ContextType } from '../../../../core/types'

interface ContextItemProps {
  source: ContextSource
  selected: boolean
  onSelect: () => void
}

const TYPE_COLORS: Record<ContextType, string> = {
  [ContextType.GlobalClaudeMd]: 'bg-accent-blue',
  [ContextType.ProjectClaudeMd]: 'bg-blue-400',
  [ContextType.FolderClaudeMd]: 'bg-blue-300',
  [ContextType.Rule]: 'bg-accent-amber',
  [ContextType.Skill]: 'bg-accent-emerald',
  [ContextType.Memory]: 'bg-accent-purple',
  [ContextType.McpServer]: 'bg-accent-rose',
  [ContextType.Settings]: 'bg-content-muted',
}

export function ContextItem({ source, selected, onSelect }: ContextItemProps) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-2 py-1.5 rounded-md flex items-center gap-2 text-sm transition-colors ${
        selected
          ? 'bg-surface-selected text-content-primary'
          : 'text-content-secondary hover:bg-surface-hover'
      }`}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${TYPE_COLORS[source.type]}`} />
      <span className="truncate flex-1">{source.name}</span>
      <span className="text-xs text-content-muted shrink-0">
        ~{source.tokenEstimate.toLocaleString()}t
      </span>
    </button>
  )
}
