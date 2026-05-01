import { normalizePath } from './glob-match'

/**
 * Given a project root and an absolute target file path, return the list of
 * directories from the root down to the target's parent (inclusive). This is
 * the chain Claude Code walks when collecting folder-level `CLAUDE.md`.
 *
 * Returns absolute paths, root-first. The root itself is *not* included —
 * callers handle the project CLAUDE.md separately (it's its own node).
 */
export function folderChain(projectRoot: string, targetPath: string): string[] {
  const root = normalizePath(projectRoot).replace(/\/$/, '')
  const target = normalizePath(targetPath)

  if (!target.startsWith(root + '/') && target !== root) {
    return []
  }

  const rel = target.slice(root.length + 1)
  if (!rel) return []

  const parts = rel.split('/')
  // Drop the filename itself; we want directory nodes only.
  parts.pop()

  const chain: string[] = []
  let cursor = root
  for (const part of parts) {
    cursor = cursor + '/' + part
    chain.push(cursor)
  }
  return chain
}
