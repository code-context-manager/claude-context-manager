import { useCallback, useEffect } from 'react'
import { useStore } from '../../store'
import { SessionTopBar } from './SessionTopBar'
import { SessionFileTree } from './SessionFileTree'

/**
 * Session answers "what is currently loaded in my active Claude Code session
 * for this project?" — a live snapshot, not a timeline.
 * See docs/decisions/0010-session-as-live-loaded-context-snapshot.md.
 */
export function SessionPage() {
  const currentProject = useStore((s) => s.currentProject)
  const sessions = useStore((s) => s.sessions)
  const sessionId = useStore((s) => s.sessionId)
  const sessionView = useStore((s) => s.sessionView)
  const loading = useStore((s) => s.sessionLoading)
  const setSessions = useStore((s) => s.setSessions)
  const setSessionId = useStore((s) => s.setSessionId)
  const setSessionView = useStore((s) => s.setSessionView)
  const setSessionLoading = useStore((s) => s.setSessionLoading)
  const selection = useStore((s) => s.detailSelections.session ?? null)
  const setDetailSelection = useStore((s) => s.setDetailSelection)

  // Load session list + pick latest on project change.
  useEffect(() => {
    if (!currentProject) {
      setSessions([])
      setSessionId(null)
      setSessionView(null)
      return
    }
    let cancelled = false
    setSessionLoading(true)
    ;(async () => {
      const [list, latest] = await Promise.all([
        window.api.listSessions(),
        window.api.getLatestSessionId(),
      ])
      if (cancelled) return
      setSessions(list)
      setSessionId(latest ?? list[0]?.id ?? null)
      setSessionLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [currentProject, setSessions, setSessionId, setSessionView, setSessionLoading])

  // Fetch view for current session.
  useEffect(() => {
    if (!sessionId) {
      setSessionView(null)
      return
    }
    let cancelled = false
    setSessionLoading(true)
    window.api.getSessionView(sessionId).then((v) => {
      if (cancelled) return
      setSessionView(v)
      setSessionLoading(false)
    })
    return () => {
      cancelled = true
      window.api.stopSessionWatch()
    }
  }, [sessionId, setSessionView, setSessionLoading])

  // Subscribe to live updates.
  useEffect(() => {
    const off = window.api.onSessionUpdate((id) => {
      if (id !== sessionId) return
      window.api.getSessionView(id).then((v) => setSessionView(v))
    })
    return off
  }, [sessionId, setSessionView])

  // Refresh the session list when a new JSONL appears (new chat started).
  // If the user was on the previous latest, follow forward to the new one.
  useEffect(() => {
    if (!currentProject) return
    const off = window.api.onSessionListUpdate(async () => {
      const [list, latest] = await Promise.all([
        window.api.listSessions(),
        window.api.getLatestSessionId(),
      ])
      setSessions(list)
      const prevLatestId = sessions[0]?.id ?? null
      const onPrevLatest = sessionId === null || sessionId === prevLatestId
      if (onPrevLatest && latest && latest !== sessionId) {
        setSessionId(latest)
      }
    })
    return off
  }, [currentProject, sessions, sessionId, setSessions, setSessionId])

  // Manual refresh: re-pull both the session list and the current view.
  // fs.watch on macOS misses events for atomically-replaced files and silently
  // fails when the JSONL didn't exist yet at watch-setup time — this is the
  // escape hatch. Calling getSessionView also re-arms the per-session watcher.
  const refresh = useCallback(async () => {
    if (!currentProject) return
    const [list, latest] = await Promise.all([
      window.api.listSessions(),
      window.api.getLatestSessionId(),
    ])
    setSessions(list)
    const targetId = sessionId ?? latest ?? list[0]?.id ?? null
    if (targetId !== sessionId) setSessionId(targetId)
    if (targetId) {
      const view = await window.api.getSessionView(targetId)
      setSessionView(view)
    }
  }, [currentProject, sessionId, setSessions, setSessionId, setSessionView])

  // Refresh when the window regains visibility — fs.watch may have missed
  // events while the app was backgrounded.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  const selectedPath =
    selection?.kind === 'session-file' ? selection.node.path : null
  const selectedNonFs =
    selection?.kind === 'session-non-fs' ? selection.section : null

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0">
      <SessionTopBar
        sessions={sessions}
        sessionId={sessionId}
        onSelect={setSessionId}
        usage={sessionView?.snapshot.lastUsage ?? null}
        model={sessionView?.snapshot.model ?? null}
        userMessages={sessionView?.snapshot.messages.userCount ?? 0}
        assistantTurns={sessionView?.snapshot.messages.assistantCount ?? 0}
        onRefresh={refresh}
      />
      <div className="flex-1 flex overflow-hidden min-w-0">
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          {loading && !sessionView ? (
            <div className="px-6 py-4 text-xs text-content-muted">Loading session…</div>
          ) : !sessionView ? (
            <div className="px-6 py-4 text-xs text-content-muted">No session selected.</div>
          ) : (
            <SessionFileTree
              tree={sessionView.tree}
              snapshot={sessionView.snapshot}
              selectedPath={selectedPath}
              selectedNonFs={selectedNonFs}
              onSelect={(node) => setDetailSelection({ kind: 'session-file', node })}
              onSelectNonFs={(section) => setDetailSelection({ kind: 'session-non-fs', section })}
            />
          )}
        </main>
      </div>
    </div>
  )
}
