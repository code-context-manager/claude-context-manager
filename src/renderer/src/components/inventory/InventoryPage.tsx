import { useStore } from '../../store'
import { ContextMap } from '../context-map/ContextMap'
import { buildImproveInventoryPrompt } from '../../../../prompts/improve-inventory'

/**
 * Inventory answers "what exists?" — a grouped list of every context
 * source in the active project.
 */
export function InventoryPage() {
  const sources = useStore((s) => s.sources)
  const currentProject = useStore((s) => s.currentProject)
  const selection = useStore((s) => s.detailSelections.inventory ?? null)
  const setDetailSelection = useStore((s) => s.setDetailSelection)
  const showToast = useStore((s) => s.showToast)

  const selectedPath =
    selection?.kind === 'context-source' ? selection.source.filePath : null

  const handleCopyImprovePrompt = async () => {
    await navigator.clipboard.writeText(buildImproveInventoryPrompt(currentProject))
    showToast('Prompt copied. Paste it into a new Claude Code chat for a clean review.')
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0">
      <div className="px-6 py-4 border-b border-edge flex items-start justify-between gap-4">
        <div>
          <h1 className="text-sm font-medium text-content-primary">Inventory</h1>
          <p className="text-xs text-content-muted mt-0.5">
            Context sources configured in this project.
          </p>
        </div>
        <button
          onClick={handleCopyImprovePrompt}
          title="Copy a prompt that asks Claude to review and improve this project's context setup"
          className="shrink-0 px-3 py-1.5 rounded-md text-xs font-medium border border-edge bg-surface-sidebar hover:bg-surface-hover hover:border-content-muted text-content-secondary hover:text-content-primary transition-colors"
        >
          Improve…
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ContextMap
          sources={sources}
          selectedPath={selectedPath}
          onSelect={(source) => setDetailSelection({ kind: 'context-source', source })}
        />
      </div>
    </div>
  )
}
