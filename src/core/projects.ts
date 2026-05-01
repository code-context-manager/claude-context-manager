import { join } from 'path'
import { getProjectsDir, decodeProjectDirName } from './path-utils'
import type { Project } from './types'
import type { FsReader } from './fs'

interface SessionInfo {
  cwd: string
  startedAt: number
}

/**
 * List all known Claude Code projects by combining:
 * 1. ~/.claude/projects/ directory entries (path-encoded folder names)
 * 2. ~/.claude/sessions/*.json for last-used timestamps
 */
export async function listProjects(fs: FsReader): Promise<Project[]> {
  const projectsDir = getProjectsDir()
  const sessionsDir = join(getProjectsDir(), '..', 'sessions')

  // Read session files for last-used timestamps
  const lastUsedMap = new Map<string, number>()
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
      if (!session) continue
      const existing = lastUsedMap.get(session.cwd)
      if (!existing || session.startedAt > existing) {
        lastUsedMap.set(session.cwd, session.startedAt)
      }
    }
  }

  // Read project directory entries
  const projectPaths = new Set<string>()
  const entries = await fs.readdir(projectsDir)
  if (entries) {
    for (const entry of entries) {
      // Skip non-directory entries and hidden files
      if (!entry.startsWith('-')) continue
      projectPaths.add(decodeProjectDirName(entry))
    }
  }

  // Also add any paths from sessions that aren't in projects dir yet
  for (const cwd of lastUsedMap.keys()) {
    projectPaths.add(cwd)
  }

  // Build project list
  const projects: Project[] = await Promise.all(
    [...projectPaths].map(async (projectPath) => {
      const s = await fs.stat(projectPath)
      const exists = s?.isDirectory ?? false
      const name = projectPath.split('/').pop() || projectPath
      return {
        path: projectPath,
        name,
        lastUsed: lastUsedMap.get(projectPath) ?? null,
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
