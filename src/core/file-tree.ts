import { join, relative, resolve } from 'path'
import type { ProjectFileEntry } from './types'
import type { FsReader } from './fs'

/**
 * Default directories the file-tree picker should skip. Keeps the tree
 * sane for large repos.
 */
const DEFAULT_IGNORE = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'build',
  'out',
  'coverage',
  '.next',
  '.nuxt',
  '.turbo',
  '.cache',
  '__pycache__',
  '.venv',
  'venv',
  'target',
])

export interface ListFilesOptions {
  /** Max total entries returned across the walk. Defaults to 5000. */
  limit?: number
  /** Max depth from the project root. Defaults to 8. */
  maxDepth?: number
}

/**
 * Walk a project directory and return a flat list of entries usable by the
 * file-tree picker. Returns both files and directories so the renderer can
 * reconstruct a tree with lazy expansion if needed.
 */
export async function listProjectFiles(
  fs: FsReader,
  projectPath: string,
  opts: ListFilesOptions = {},
): Promise<ProjectFileEntry[]> {
  const limit = opts.limit ?? 5000
  const maxDepth = opts.maxDepth ?? 8
  const root = resolve(projectPath)
  const out: ProjectFileEntry[] = []

  async function walk(dir: string, depth: number): Promise<void> {
    if (out.length >= limit) return
    if (depth > maxDepth) return

    const entries = await fs.readdirWithTypes(dir)
    if (!entries) return

    entries.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    for (const entry of entries) {
      if (out.length >= limit) return
      if (entry.name.startsWith('.') && entry.name !== '.claude') continue
      if (DEFAULT_IGNORE.has(entry.name)) continue
      const abs = join(dir, entry.name)
      out.push({
        path: abs,
        name: entry.name,
        relPath: relative(root, abs),
        isDirectory: entry.isDirectory,
      })
      if (entry.isDirectory) {
        await walk(abs, depth + 1)
      }
    }
  }

  await walk(root, 0)
  return out
}
