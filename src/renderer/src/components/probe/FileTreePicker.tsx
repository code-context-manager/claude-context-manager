import { useEffect, useMemo, useState } from 'react'
import type { ProjectFileEntry } from '../../../../core/types'
import { TreeRow } from '../common/TreeRow'

interface FileTreePickerProps {
  projectPath: string | null
  selectedPath: string | null
  onSelect: (absPath: string) => void
}

interface TreeNode {
  entry: ProjectFileEntry
  children: TreeNode[]
}

/**
 * Simple file-tree picker for selecting a Probe target. Loads the full file
 * list once per project (main caps at ~5000 entries), then builds a local
 * tree with expand/collapse on directories.
 *
 * Visually mirrors SessionFileTree (mono font, `name/` for directories) so
 * the two tree views feel like the same thing.
 */
export function FileTreePicker({ projectPath, selectedPath, onSelect }: FileTreePickerProps) {
  const [entries, setEntries] = useState<ProjectFileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (!projectPath) {
      setEntries([])
      return
    }
    setLoading(true)
    window.api.listProjectFiles().then((result) => {
      setEntries(result)
      setLoading(false)
    })
  }, [projectPath])

  const tree = useMemo(() => buildTree(entries, projectPath), [entries, projectPath])

  if (!projectPath) {
    return <div className="p-4 text-xs text-content-muted">Select a project first.</div>
  }

  return (
    <div className="flex-1 overflow-y-auto py-2 text-xs font-mono">
      {loading ? (
        <div className="px-3 py-2 text-content-muted">Loading files…</div>
      ) : tree.length === 0 ? (
        <div className="px-3 py-2 text-content-muted">No files.</div>
      ) : (
        tree.map((node) => (
          <PickerRow
            key={node.entry.path}
            node={node}
            depth={0}
            expanded={expanded}
            onToggle={(path) => {
              setExpanded((prev) => {
                const next = new Set(prev)
                if (next.has(path)) next.delete(path)
                else next.add(path)
                return next
              })
            }}
            selectedPath={selectedPath}
            onSelect={onSelect}
          />
        ))
      )}
    </div>
  )
}

interface PickerRowProps {
  node: TreeNode
  depth: number
  expanded: Set<string>
  onToggle: (path: string) => void
  selectedPath: string | null
  onSelect: (path: string) => void
}

function PickerRow({ node, depth, expanded, onToggle, selectedPath, onSelect }: PickerRowProps) {
  const { entry, children } = node
  const isOpen = expanded.has(entry.path)
  const isSelected = entry.path === selectedPath
  const chevron = entry.isDirectory ? (isOpen ? 'open' : 'closed') : 'none'

  return (
    <div>
      <TreeRow
        depth={depth}
        selected={isSelected}
        chevron={chevron}
        onClick={() => {
          if (entry.isDirectory) onToggle(entry.path)
          else onSelect(entry.path)
        }}
      >
        {entry.isDirectory ? (
          <span className="text-content-secondary truncate">{entry.name}/</span>
        ) : (
          <span className="text-content-primary truncate">{entry.name}</span>
        )}
      </TreeRow>
      {entry.isDirectory && isOpen && children.length > 0 && (
        <div>
          {children.map((child) => (
            <PickerRow
              key={child.entry.path}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function buildTree(entries: ProjectFileEntry[], projectPath: string | null): TreeNode[] {
  if (!projectPath) return []
  const byPath = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  for (const entry of entries) {
    byPath.set(entry.path, { entry, children: [] })
  }
  for (const entry of entries) {
    const node = byPath.get(entry.path)
    if (!node) continue
    const parent = byPath.get(parentDir(entry.path))
    if (parent && parent.entry.path !== projectPath) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

/** Strip the last path segment, recognising both `/` and `\` separators. */
function parentDir(p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  return i === -1 ? '' : p.slice(0, i)
}
