import { watch, type FSWatcher } from 'fs'
import { join } from 'path'
import type { BrowserWindow } from 'electron'
import { scanProject } from '../core/scanner'
import { nodeFsReader } from '../core/fs'
import { nodeClaudeCli } from './claude-cli'
import { getClaudeHome, getProjectDataDir } from '../core/path-utils'

const contextWatchers: FSWatcher[] = []
let contextDebounce: ReturnType<typeof setTimeout> | null = null
let lastSourceCount = 0

const sessionWatchers: FSWatcher[] = []
let sessionDebounce: ReturnType<typeof setTimeout> | null = null
let watchedSessionId: string | null = null

const sessionListWatchers: FSWatcher[] = []
let sessionListDebounce: ReturnType<typeof setTimeout> | null = null

function getDebounceMs(): number {
  if (lastSourceCount <= 20) return 200
  if (lastSourceCount <= 50) return 500
  if (lastSourceCount <= 100) return 1000
  return 2000
}

export function startWatching(projectPath: string, win: BrowserWindow): void {
  stopWatching()

  const dirsToWatch = [
    join(projectPath, '.claude'),
    join(projectPath, 'CLAUDE.md'),
    getClaudeHome(),
  ]

  const notify = () => {
    if (contextDebounce) clearTimeout(contextDebounce)
    contextDebounce = setTimeout(async () => {
      try {
        const sources = await scanProject(nodeFsReader, projectPath, nodeClaudeCli)
        lastSourceCount = sources.length
        if (!win.isDestroyed()) {
          win.webContents.send('context-update', sources)
        }
      } catch {
        // Scan failed, ignore
      }
    }, getDebounceMs())
  }

  for (const dir of dirsToWatch) {
    try {
      const watcher = watch(dir, { recursive: true }, notify)
      contextWatchers.push(watcher)
    } catch {
      // Directory might not exist yet
    }
  }
}

export function stopWatching(): void {
  for (const w of contextWatchers) w.close()
  contextWatchers.length = 0
  if (contextDebounce) {
    clearTimeout(contextDebounce)
    contextDebounce = null
  }
  lastSourceCount = 0
  stopSessionWatch()
  stopSessionListWatch()
}

/**
 * Watch the project's session directory for new/removed JSONLs and notify
 * the renderer so the session dropdown can refresh when a new chat starts.
 */
export function startSessionListWatch(projectPath: string, win: BrowserWindow): void {
  stopSessionListWatch()
  const dir = getProjectDataDir(projectPath)
  const notify = () => {
    if (sessionListDebounce) clearTimeout(sessionListDebounce)
    sessionListDebounce = setTimeout(() => {
      if (!win.isDestroyed()) {
        win.webContents.send('session-list-update')
      }
    }, 300)
  }
  try {
    const watcher = watch(dir, notify)
    sessionListWatchers.push(watcher)
  } catch {
    // Project data dir may not exist yet — fine.
  }
}

export function stopSessionListWatch(): void {
  for (const w of sessionListWatchers) w.close()
  sessionListWatchers.length = 0
  if (sessionListDebounce) {
    clearTimeout(sessionListDebounce)
    sessionListDebounce = null
  }
}

/**
 * Watch a single session JSONL and notify the renderer when it changes.
 * Replaces any previous session watch.
 */
export function startSessionWatch(
  projectPath: string,
  sessionId: string,
  win: BrowserWindow,
): void {
  stopSessionWatch()
  watchedSessionId = sessionId
  const jsonlPath = join(getProjectDataDir(projectPath), `${sessionId}.jsonl`)
  const notify = () => {
    if (sessionDebounce) clearTimeout(sessionDebounce)
    sessionDebounce = setTimeout(() => {
      if (!win.isDestroyed() && watchedSessionId) {
        win.webContents.send('session-update', watchedSessionId)
      }
    }, 300)
  }
  try {
    const watcher = watch(jsonlPath, notify)
    sessionWatchers.push(watcher)
  } catch {
    // JSONL doesn't exist yet — that's fine, nothing to watch.
  }
}

export function stopSessionWatch(): void {
  for (const w of sessionWatchers) w.close()
  sessionWatchers.length = 0
  if (sessionDebounce) {
    clearTimeout(sessionDebounce)
    sessionDebounce = null
  }
  watchedSessionId = null
}
