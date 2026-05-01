import type {
  ContextSource,
  Project,
  ProbeResult,
  ProjectFileEntry,
  SessionSummary,
  SessionView,
} from '../../core/types'
import type { PlaybookLoadResult } from '../../core/playbook'

export interface OpenOption {
  id: string
  label: string
  primary?: boolean
}

type OpenResult = { ok: true } | { ok: false; error: string }

interface Api {
  // Inventory
  getContextSources(): Promise<ContextSource[]>

  // File access
  getFileContent(filePath: string): Promise<string | null>
  listOpenOptions(): Promise<OpenOption[]>
  openFileWith(filePath: string, optionId: string): Promise<OpenResult>

  // Projects
  getProjects(): Promise<Project[]>
  switchProject(projectPath: string): Promise<ContextSource[]>
  getCurrentProject(): Promise<string | null>

  // Probe
  probeFile(targetPath: string): Promise<ProbeResult | null>
  listProjectFiles(): Promise<ProjectFileEntry[]>

  // Session
  listSessions(): Promise<SessionSummary[]>
  getLatestSessionId(): Promise<string | null>
  getSessionView(sessionId: string): Promise<SessionView | null>
  stopSessionWatch(): Promise<void>

  // Playbook
  getPlaybookEntries(): Promise<PlaybookLoadResult>

  // Events
  onContextUpdate(callback: (sources: ContextSource[]) => void): () => void
  onSessionUpdate(callback: (sessionId: string) => void): () => void
  onSessionListUpdate(callback: () => void): () => void
  onSetTheme(callback: (mode: string) => void): () => void
}

declare global {
  interface Window {
    api: Api
  }
}
