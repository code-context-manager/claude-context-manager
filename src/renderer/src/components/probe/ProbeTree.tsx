import type { ProbeNode, ProbeResult } from '../../../../core/types'

interface ProbeTreeProps {
  result: ProbeResult | null
  loading: boolean
  selectedId: string | null
  onSelect: (node: ProbeNode) => void
  projectPath: string | null
}

const KIND_COLOR: Record<ProbeNode['kind'], string> = {
  'system-prompt': 'bg-content-muted',
  'env-info': 'bg-content-muted',
  'global-claude-md': 'bg-accent-blue',
  'project-claude-md': 'bg-blue-400',
  'folder-claude-md': 'bg-blue-300',
  memory: 'bg-accent-purple',
  rule: 'bg-accent-amber',
  skill: 'bg-accent-emerald',
  hook: 'bg-accent-rose',
  'mcp-index': 'bg-accent-rose',
  'mcp-schemas': 'bg-accent-rose',
  more: 'bg-content-muted',
}

export function ProbeTree({ result, loading, selectedId, onSelect, projectPath }: ProbeTreeProps) {
  if (loading) {
    return <div className="p-6 text-sm text-content-muted">Probing…</div>
  }
  if (!result) {
    return (
      <div className="p-6 text-sm text-content-muted">
        Pick a file from the left to see what context Claude would load for it.
      </div>
    )
  }

  const certain = result.tree.filter((n) => n.state === 'certain')
  const conditional = result.tree.filter((n) => n.state === 'conditional')
  const relTarget = projectPath ? relPath(result.targetPath, projectPath) : result.targetPath

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="mb-4">
        <div className="text-xs text-content-muted">Target</div>
        <div className="text-sm font-mono text-content-primary truncate">{relTarget}</div>
      </div>

      <div className="flex gap-4 mb-4 text-xs">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface-raised">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-content-secondary">Certain</span>
          <span className="text-content-muted">~{result.certainTokens.toLocaleString()} tokens</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface-raised">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <span className="text-content-secondary">Conditional</span>
          <span className="text-content-muted">~{result.conditionalTokens.toLocaleString()} tokens</span>
        </div>
      </div>

      <TreeGroup
        title="Certain — loads on file-read"
        description="Always-on bundle + folder CLAUDE.md chain + matching rules + MCP index"
        nodes={certain}
        selectedId={selectedId}
        onSelect={onSelect}
      />
      <TreeGroup
        title="Conditional — loads only when triggered"
        description="Skills, hooks, MCP schemas, memory overflow"
        nodes={conditional}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </div>
  )
}

interface TreeGroupProps {
  title: string
  description: string
  nodes: ProbeNode[]
  selectedId: string | null
  onSelect: (node: ProbeNode) => void
}

function TreeGroup({ title, description, nodes, selectedId, onSelect }: TreeGroupProps) {
  if (nodes.length === 0) return null
  return (
    <section className="mb-6">
      <header className="mb-2">
        <h2 className="text-xs font-medium text-content-muted uppercase tracking-wider">{title}</h2>
        <p className="text-xs text-content-muted mt-0.5">{description}</p>
      </header>
      <div className="flex flex-col gap-0.5">
        {nodes.map((node) => (
          <NodeRow key={node.id} node={node} depth={0} selectedId={selectedId} onSelect={onSelect} />
        ))}
      </div>
    </section>
  )
}

interface NodeRowProps {
  node: ProbeNode
  depth: number
  selectedId: string | null
  onSelect: (node: ProbeNode) => void
}

function NodeRow({ node, depth, selectedId, onSelect }: NodeRowProps) {
  const active = selectedId === node.id
  return (
    <div>
      <button
        onClick={() => onSelect(node)}
        className={`w-full text-left px-3 py-2 rounded-md transition-colors border ${
          active
            ? 'bg-surface-selected border-edge-strong'
            : 'border-transparent hover:bg-surface-hover'
        } ${node.state === 'conditional' ? 'opacity-80' : ''}`}
        style={{ marginLeft: `${depth * 16}px` }}
      >
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${KIND_COLOR[node.kind]}`} />
          <span className="text-sm text-content-primary truncate">{node.label}</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${
              node.state === 'certain'
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
            }`}
          >
            {node.state}
          </span>
          <span className="ml-auto text-xs text-content-muted shrink-0">
            ~{node.tokens.toLocaleString()}t
          </span>
        </div>
        {node.trigger && (
          <div className="mt-1 text-xs text-content-muted pl-4">{node.trigger}</div>
        )}
        {node.note && (
          <div className="mt-0.5 text-xs text-content-disabled pl-4">{node.note}</div>
        )}
      </button>
      {node.children?.map((child) => (
        <NodeRow
          key={child.id}
          node={child}
          depth={depth + 1}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

function relPath(abs: string, projectRoot: string): string {
  if (abs.startsWith(projectRoot + '/')) return abs.slice(projectRoot.length + 1)
  return abs
}
