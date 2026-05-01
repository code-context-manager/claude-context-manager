import { X } from 'lucide-react'
import type { DetailSelection } from '../../store'
import { useStore } from '../../store'
import { ContextSourceDetail } from './detail-views/ContextSourceDetail'
import { ProbeNodeDetail } from './detail-views/ProbeNodeDetail'
import { SessionFileDetail } from './detail-views/SessionFileDetail'
import { NonFsSectionDetail } from './detail-views/NonFsSectionDetail'

interface DetailDrawerProps {
  selection: DetailSelection | null
  onClose: () => void
}

export function DetailDrawer({ selection, onClose }: DetailDrawerProps) {
  const sessionView = useStore((s) => s.sessionView)

  return (
    <aside className="h-full flex flex-col">
      <header className="h-10 shrink-0 flex items-center justify-between px-4 border-b border-edge">
        <h3 className="text-xs font-medium text-content-muted uppercase tracking-wider">Details</h3>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-surface-hover text-content-muted"
          title="Close detail (⌘I)"
        >
          <X className="w-4 h-4" strokeWidth={2} />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto">
        {!selection ? (
          <div className="h-full flex items-center justify-center px-6 text-center">
            <p className="text-xs text-content-muted">
              Select an item to see its details.
            </p>
          </div>
        ) : selection.kind === 'context-source' ? (
          <ContextSourceDetail source={selection.source} />
        ) : selection.kind === 'probe-node' ? (
          <ProbeNodeDetail node={selection.node} />
        ) : selection.kind === 'session-file' ? (
          <SessionFileDetail node={selection.node} />
        ) : sessionView ? (
          <NonFsSectionDetail section={selection.section} snapshot={sessionView.snapshot} />
        ) : null}
      </div>
    </aside>
  )
}
