import { ipcMain, BrowserWindow, app } from 'electron'
import { resolve as resolvePath } from 'path'
import { listOpenOptions, openWith } from './file-opener'
import {
  startWatching,
  startSessionWatch,
  stopSessionWatch,
  startSessionListWatch,
} from './file-watcher'
import { nodeFsReader } from '../core/fs'
import { nodeClaudeCli } from './claude-cli'
import { scanProject } from '../core/scanner'
import { listProjects } from '../core/projects'
import { probeFile } from '../core/probe'
import { listSessionsForProject } from '../core/sessions'
import { buildSessionView, latestSessionId } from '../core/session-view'
import { listProjectFiles } from '../core/file-tree'
import { loadPlaybookFromLocal } from '../core/playbook'

const fs = nodeFsReader

let currentProjectPath: string | null = null

export function setProjectPath(projectPath: string): void {
  currentProjectPath = projectPath
}

export function getProjectPath(): string | null {
  return currentProjectPath
}

export function registerIpcHandlers(): void {
  // ── Inventory ────────────────────────────────────────────────────────
  ipcMain.handle('get-context-sources', async () => {
    if (!currentProjectPath) return []
    return scanProject(fs, currentProjectPath, nodeClaudeCli)
  })

  // ── File access ──────────────────────────────────────────────────────
  ipcMain.handle('get-file-content', async (_event, filePath: string) => {
    return fs.readFile(filePath)
  })

  ipcMain.handle('list-open-options', async () => {
    return listOpenOptions()
  })

  ipcMain.handle('open-file-with', async (_event, filePath: string, optionId: string) => {
    try {
      await openWith(filePath, optionId)
      return { ok: true as const }
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // ── Projects ─────────────────────────────────────────────────────────
  ipcMain.handle('get-projects', async () => {
    return listProjects(fs)
  })

  ipcMain.handle('switch-project', async (_event, projectPath: string) => {
    currentProjectPath = projectPath
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      startWatching(projectPath, win)
      startSessionListWatch(projectPath, win)
    }
    return scanProject(fs, projectPath, nodeClaudeCli)
  })

  ipcMain.handle('get-current-project', async () => {
    return currentProjectPath
  })

  // ── Probe ────────────────────────────────────────────────────────────
  ipcMain.handle('probe-file', async (_event, targetPath: string) => {
    if (!currentProjectPath) return null
    return probeFile(fs, currentProjectPath, targetPath, nodeClaudeCli)
  })

  ipcMain.handle('list-project-files', async () => {
    if (!currentProjectPath) return []
    return listProjectFiles(fs, currentProjectPath)
  })

  // ── Session ──────────────────────────────────────────────────────────
  ipcMain.handle('list-sessions', async () => {
    if (!currentProjectPath) return []
    return listSessionsForProject(fs, currentProjectPath)
  })

  ipcMain.handle('get-latest-session-id', async () => {
    if (!currentProjectPath) return null
    return latestSessionId(fs, currentProjectPath)
  })

  ipcMain.handle('get-session-view', async (_event, sessionId: string) => {
    if (!currentProjectPath) return null
    const win = BrowserWindow.getAllWindows()[0]
    if (win) startSessionWatch(currentProjectPath, sessionId, win)
    return buildSessionView(fs, currentProjectPath, sessionId, nodeClaudeCli)
  })

  ipcMain.handle('stop-session-watch', async () => {
    stopSessionWatch()
  })

  // ── Playbook ─────────────────────────────────────────────────────────
  // v0 resolution: env override → sibling of the manager repo. Cache and
  // remote sources are not yet wired (see docs/playbook.md).
  ipcMain.handle('get-playbook-entries', async () => {
    const envOverride = process.env.CCM_PLAYBOOK_PATH
    const candidate =
      envOverride && envOverride.length > 0
        ? envOverride
        : resolvePath(app.getAppPath(), '..', 'claude-context-playbook')
    return loadPlaybookFromLocal(nodeFsReader, candidate)
  })
}
