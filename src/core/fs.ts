import { readFile, readdir, stat } from 'fs/promises'

export interface FsStat {
  isFile: boolean
  isDirectory: boolean
  mtimeMs: number
  birthtimeMs: number
}

export interface DirEntry {
  name: string
  isDirectory: boolean
}

/**
 * Read-only filesystem facade that core/ depends on instead of `fs/promises`.
 * All methods return `null` rather than throwing on missing/unreadable paths,
 * since "absent" is a routine state for the files we read (CLAUDE.md, rules,
 * settings — most projects don't have most of them).
 *
 * Adapters supply an implementation: `nodeFsReader` for real disk, an
 * in-memory impl for tests.
 */
export interface FsReader {
  readFile(path: string): Promise<string | null>
  readdir(path: string): Promise<string[] | null>
  readdirWithTypes(path: string): Promise<DirEntry[] | null>
  stat(path: string): Promise<FsStat | null>
}

export const nodeFsReader: FsReader = {
  async readFile(path) {
    try {
      return await readFile(path, 'utf-8')
    } catch {
      return null
    }
  },
  async readdir(path) {
    try {
      return await readdir(path)
    } catch {
      return null
    }
  },
  async readdirWithTypes(path) {
    try {
      const ents = await readdir(path, { withFileTypes: true })
      return ents.map((e) => ({ name: e.name, isDirectory: e.isDirectory() }))
    } catch {
      return null
    }
  },
  async stat(path) {
    try {
      const s = await stat(path)
      return {
        isFile: s.isFile(),
        isDirectory: s.isDirectory(),
        mtimeMs: s.mtimeMs,
        birthtimeMs: s.birthtimeMs,
      }
    } catch {
      return null
    }
  },
}
