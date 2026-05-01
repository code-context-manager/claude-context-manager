import { create } from 'zustand'
import type {
  AppMode,
  ContextSource,
  ProbeNode,
  ProbeResult,
  SessionSummary,
  SessionTreeNode,
  SessionView,
} from '../../../core/types'
import type { ThemeMode } from '../hooks/useTheme'

export type NonFsSectionKind =
  | 'messages'
  | 'system-prompt'
  | 'env-info'
  | 'system-tools'
  | 'memory'
  | 'claude-md-chain'
  | 'skills'
  | 'mcp-schemas'

/**
 * Whatever the user clicked on — shown in the shared right drawer.
 */
export type DetailSelection =
  | { kind: 'context-source'; source: ContextSource }
  | { kind: 'probe-node'; node: ProbeNode }
  | { kind: 'session-file'; node: SessionTreeNode }
  | { kind: 'session-non-fs'; section: NonFsSectionKind }

function modeForSelection(selection: DetailSelection): AppMode {
  switch (selection.kind) {
    case 'context-source':
      return 'inventory'
    case 'probe-node':
      return 'probe'
    case 'session-file':
    case 'session-non-fs':
      return 'session'
  }
}

interface AppState {
  mode: AppMode
  setMode: (mode: AppMode) => void

  sources: ContextSource[]
  loading: boolean
  setSources: (sources: ContextSource[]) => void
  setLoading: (loading: boolean) => void

  currentProject: string | null
  setCurrentProject: (path: string | null) => void

  probeTarget: string | null
  probeResult: ProbeResult | null
  probeLoading: boolean
  setProbeTarget: (path: string | null) => void
  setProbeResult: (result: ProbeResult | null) => void
  setProbeLoading: (loading: boolean) => void

  // Session
  sessions: SessionSummary[]
  sessionId: string | null
  sessionView: SessionView | null
  sessionLoading: boolean
  setSessions: (sessions: SessionSummary[]) => void
  setSessionId: (id: string | null) => void
  setSessionView: (view: SessionView | null) => void
  setSessionLoading: (loading: boolean) => void

  // Selection is per-page so switching modes doesn't carry a stale selection
  // from one page into another's drawer.
  detailSelections: Partial<Record<AppMode, DetailSelection>>
  detailOpen: boolean
  setDetailSelection: (selection: DetailSelection | null) => void
  toggleDetail: () => void
  setDetailOpen: (open: boolean) => void

  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void

  toast: { id: number; message: string } | null
  showToast: (message: string) => void
  dismissToast: () => void
}

export const useStore = create<AppState>((set) => ({
  mode: 'home',
  setMode: (mode) => set({ mode }),

  sources: [],
  loading: true,
  setSources: (sources) => set({ sources }),
  setLoading: (loading) => set({ loading }),

  currentProject: null,
  setCurrentProject: (currentProject) => set({ currentProject }),

  probeTarget: null,
  probeResult: null,
  probeLoading: false,
  setProbeTarget: (probeTarget) => set({ probeTarget }),
  setProbeResult: (probeResult) => set({ probeResult }),
  setProbeLoading: (probeLoading) => set({ probeLoading }),

  sessions: [],
  sessionId: null,
  sessionView: null,
  sessionLoading: false,
  setSessions: (sessions) => set({ sessions }),
  setSessionId: (sessionId) => set({ sessionId }),
  setSessionView: (sessionView) => set({ sessionView }),
  setSessionLoading: (sessionLoading) => set({ sessionLoading }),

  detailSelections: {},
  detailOpen: true,
  setDetailSelection: (selection) =>
    set((s) => {
      if (!selection) return { detailSelections: {} }
      const mode = modeForSelection(selection)
      return {
        detailSelections: { ...s.detailSelections, [mode]: selection },
        detailOpen: true,
      }
    }),
  toggleDetail: () => set((s) => ({ detailOpen: !s.detailOpen })),
  setDetailOpen: (detailOpen) => set({ detailOpen }),

  themeMode: (localStorage.getItem('ccm-theme') as ThemeMode) || 'system',
  setThemeMode: (themeMode) => set({ themeMode }),

  toast: null,
  showToast: (message) => {
    const id = Date.now() + Math.random()
    set({ toast: { id, message } })
    setTimeout(() => {
      const current = useStore.getState().toast
      if (current?.id === id) set({ toast: null })
    }, 8000)
  },
  dismissToast: () => set({ toast: null }),
}))
