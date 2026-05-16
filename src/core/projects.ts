import { join } from 'path'
import {
  getProjectsDir,
  encodeProjectPath,
  decodeProjectDirName,
  getProjectDisplayName,
  getProjectFamilyBasePath,
} from './path-utils'
import type { Project } from './types'
import type { FsReader } from './fs'

interface SessionInfo {
  cwd: string
  startedAt: number
}

/**
 * List all known Claude Code projects by combining:
 * 1. ~/.claude/projects/ directory entries (path-encoded folder names)
 * 2. ~/.claude/sessions/*.json for last-used timestamps and authoritative
 *    `cwd` values used to resolve encoded directory names back to real paths
 * 3. The first JSONL line in each project directory as a fallback `cwd`
 *    source when no session JSON references that directory.
 *
 * Directory-name decoding is lossy on Windows (`\.claude` and `\\claude`
 * both encode to `--claude`), so we prefer authoritative `cwd` strings from
 * Claude Code's own metadata and only fall back to the heuristic decode
 * when neither source provides one.
 */
export async function listProjects(fs: FsReader): Promise<Project[]> {
  const projectsDir = getProjectsDir()
  const sessionsDir = join(getProjectsDir(), '..', 'sessions')

  // 1. Read ~/.claude/sessions/*.json — these record `cwd` and `startedAt`
  //    for every Claude Code session and are the authoritative source for
  //    real project paths.
  const lastUsedMap = new Map<string, number>()
  const dirToCwd = new Map<string, string>() // encoded-dir-name → real cwd
  const sessionFiles = await fs.readdir(sessionsDir)
  if (sessionFiles) {
    const jsonFiles = sessionFiles.filter((f) => f.endsWith('.json'))
    const sessions = await Promise.all(
      jsonFiles.map(async (f) => {
        const raw = await fs.readFile(join(sessionsDir, f))
        if (!raw) return null
        try {
          return JSON.parse(raw) as SessionInfo
        } catch {
          return null
        }
      }),
    )
    for (const session of sessions) {
      if (!session?.cwd) continue
      const existing = lastUsedMap.get(session.cwd)
      if (!existing || session.startedAt > existing) {
        lastUsedMap.set(session.cwd, session.startedAt)
      }
      dirToCwd.set(encodeProjectPath(session.cwd), session.cwd)
    }
  }

  // 2. Walk ~/.claude/projects/ entries. Skip non-encoded names (dotfiles,
  //    stray junk). For each known encoded folder we resolve the real path
  //    via, in order: cached cwd from session JSON → first jsonl peek →
  //    lossy decode.
  const projectPaths = new Set<string>()
  const entries = await fs.readdir(projectsDir)
  if (entries) {
    const resolved = await Promise.all(
      entries.map(async (entry) => {
        if (entry.startsWith('.')) return null
        if (!/^(-|[A-Za-z]-)/.test(entry)) return null
        const cached = dirToCwd.get(entry)
        if (cached) return cached
        const peeked = await peekProjectCwd(fs, join(projectsDir, entry))
        return peeked ?? decodeProjectDirName(entry)
      }),
    )
    for (const p of resolved) {
      if (p) projectPaths.add(p)
    }
  }

  // 3. Add any cwds from session metadata that don't have a projects/ dir
  //    yet (e.g. session was just started, dir not yet created).
  for (const cwd of lastUsedMap.keys()) {
    projectPaths.add(cwd)
  }

  // 4. Collapse git-worktree checkouts into their parent repo. A worktree
  //    under `<repo>/.claude/worktrees/<name>` is an internal sandbox of the
  //    repo, not a project the user picked, so it should not surface as its
  //    own picker entry. Group every path by its family base path and roll
  //    `lastUsed` up to the most recent activity across the whole family —
  //    selecting the repo then resolves sessions across all checkouts (the
  //    session resolver is already worktree-aware).
  const basePaths = new Set<string>()
  const baseLastUsed = new Map<string, number>()
  for (const projectPath of projectPaths) {
    const base = getProjectFamilyBasePath(projectPath)
    basePaths.add(base)
    const used = lastUsedMap.get(projectPath)
    if (used != null) {
      const existing = baseLastUsed.get(base)
      if (existing == null || used > existing) baseLastUsed.set(base, used)
    }
  }

  // Build project list
  const projects: Project[] = await Promise.all(
    [...basePaths].map(async (projectPath) => {
      const s = await fs.stat(projectPath)
      const exists = s?.isDirectory ?? false
      const name = getProjectDisplayName(projectPath)
      return {
        path: projectPath,
        name,
        lastUsed: baseLastUsed.get(projectPath) ?? null,
        exists,
      }
    }),
  )

  // Sort: most recently used first, then alphabetically
  projects.sort((a, b) => {
    if (a.lastUsed && b.lastUsed) return b.lastUsed - a.lastUsed
    if (a.lastUsed) return -1
    if (b.lastUsed) return 1
    return a.name.localeCompare(b.name)
  })

  return projects
}

/**
 * Read the `cwd` field from the first JSONL line in a project directory
 * that has one. Claude Code records `cwd` on most session-message lines,
 * so any line will do; we just take the first match. Returns null if no
 * jsonl files exist or none contain a `cwd`.
 */
async function peekProjectCwd(fs: FsReader, dir: string): Promise<string | null> {
  const entries = await fs.readdir(dir)
  if (!entries) return null
  const jsonl = entries.find((e) => e.endsWith('.jsonl'))
  if (!jsonl) return null
  const raw = await fs.readFile(join(dir, jsonl))
  if (!raw) return null
  for (const line of raw.split('\n')) {
    if (!line.includes('"cwd"')) continue
    try {
      const obj = JSON.parse(line) as { cwd?: unknown }
      if (typeof obj.cwd === 'string' && obj.cwd.length > 0) return obj.cwd
    } catch {
      // malformed line — keep scanning
    }
  }
  return null
}
