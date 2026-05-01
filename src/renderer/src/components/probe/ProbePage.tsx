import { useEffect } from 'react'
import { useStore } from '../../store'
import { FileTreePicker } from './FileTreePicker'
import { ProbeTree } from './ProbeTree'
import { buildImproveProbePrompt } from '../../../../prompts/improve-probe'

/**
 * Probe answers "if Claude opened this file, what would it load?" The
 * picker on the left selects a target; the tree on the right is the
 * computed static load-tree.
 */
export function ProbePage() {
  const currentProject = useStore((s) => s.currentProject)
  const probeTarget = useStore((s) => s.probeTarget)
  const probeResult = useStore((s) => s.probeResult)
  const probeLoading = useStore((s) => s.probeLoading)
  const setProbeTarget = useStore((s) => s.setProbeTarget)
  const setProbeResult = useStore((s) => s.setProbeResult)
  const setProbeLoading = useStore((s) => s.setProbeLoading)
  const selection = useStore((s) => s.detailSelections.probe ?? null)
  const setDetailSelection = useStore((s) => s.setDetailSelection)
  const showToast = useStore((s) => s.showToast)

  const handleCopyImprovePrompt = async () => {
    await navigator.clipboard.writeText(
      buildImproveProbePrompt(currentProject, probeTarget),
    )
    showToast(
      'Prompt copied. Paste it into a new Claude Code chat, or your active session if you are already working on this file.',
    )
  }

  useEffect(() => {
    if (!probeTarget) {
      setProbeResult(null)
      return
    }
    setProbeLoading(true)
    window.api.probeFile(probeTarget).then((result) => {
      setProbeResult(result)
      setProbeLoading(false)
    })
  }, [probeTarget, setProbeResult, setProbeLoading])

  // Reset probe state when project changes
  useEffect(() => {
    setProbeTarget(null)
    setProbeResult(null)
  }, [currentProject, setProbeTarget, setProbeResult])

  const selectedNodeId = selection?.kind === 'probe-node' ? selection.node.id : null

  return (
    <div className="flex-1 flex overflow-hidden min-w-0">
      <aside className="w-72 shrink-0 border-r border-edge bg-surface-sidebar flex flex-col">
        <div className="px-3 py-2 border-b border-edge">
          <h2 className="text-xs font-medium text-content-muted uppercase tracking-wider">
            Probe target
          </h2>
        </div>
        <FileTreePicker
          projectPath={currentProject}
          selectedPath={probeTarget}
          onSelect={setProbeTarget}
        />
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="px-6 py-4 border-b border-edge flex items-start justify-between gap-4">
          <div>
            <h1 className="text-sm font-medium text-content-primary">Probe</h1>
            <p className="text-xs text-content-muted mt-0.5">
              Static prediction — what Claude would load for the selected file.
            </p>
          </div>
          <button
            onClick={handleCopyImprovePrompt}
            disabled={!probeTarget}
            title={
              probeTarget
                ? "Copy a prompt that asks Claude to review and improve the static context for this file"
                : 'Pick a file first'
            }
            className="shrink-0 px-3 py-1.5 rounded-md text-xs font-medium border border-edge bg-surface-sidebar hover:bg-surface-hover hover:border-content-muted text-content-secondary hover:text-content-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface-sidebar disabled:hover:border-edge disabled:hover:text-content-secondary"
          >
            Improve…
          </button>
        </div>
        <ProbeTree
          result={probeResult}
          loading={probeLoading}
          selectedId={selectedNodeId}
          onSelect={(node) => setDetailSelection({ kind: 'probe-node', node })}
          projectPath={currentProject}
        />
      </main>
    </div>
  )
}
