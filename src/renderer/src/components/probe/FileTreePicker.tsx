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
 */
export function FileTreePicker({ projectPath, selectedPath, onSelect }: FileTreePickerProps) {
  const [entries, setEntries] = useState<ProjectFileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [filter, setFilter] = useState('')

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
  const visibleTree = useMemo(() => {
    if (!filter.trim()) return tree
    return filterTree(tree, filter.toLowerCase())
  }, [tree, filter])

  if (!projectPath) {
    return <div className="p-4 text-xs text-content-muted">Select a project first.</div>
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-edge">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter files…"
          className="w-full px-2 py-1 text-xs rounded bg-surface-input border border-edge text-content-primary placeholder:text-content-muted focus:outline-none focus:border-edge-strong"
        />
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {loading ? (
          <div className="px-3 py-2 text-xs text-content-muted">Loading files…</div>
        ) : visibleTree.length === 0 ? (
          <div className="px-3 py-2 text-xs text-content-muted">No matches.</div>
        ) : (
          visibleTree.map((node) => (
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
              forceExpanded={filter.trim().length > 0}
            />
          ))
        )}
      </div>
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
  forceExpanded: boolean
}

function PickerRow({ node, depth, expanded, onToggle, selectedPath, onSelect, forceExpanded }: PickerRowProps) {
  const { entry, children } = node
  const isOpen = forceExpanded || expanded.has(entry.path)
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
        <span className="truncate">{entry.name}</span>
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
              forceExpanded={forceExpanded}
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
    const parentPath = entry.path.slice(0, entry.path.lastIndexOf('/'))
    const node = byPath.get(entry.path)
    if (!node) continue
    const parent = byPath.get(parentPath)
    if (parent && parentPath !== projectPath) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  const result: TreeNode[] = []
  for (const node of nodes) {
    const children = filterTree(node.children, query)
    const nameMatch = node.entry.name.toLowerCase().includes(query) || node.entry.relPath.toLowerCase().includes(query)
    if (nameMatch || children.length > 0) {
      result.push({ entry: node.entry, children })
    }
  }
  return result
}
