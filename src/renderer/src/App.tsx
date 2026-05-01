import { useEffect, useCallback } from 'react'
import { useStore } from './store'
import { useTheme } from './hooks/useTheme'
import { HeaderBar } from './components/shell/HeaderBar'
import { ModeSidebar } from './components/shell/ModeSidebar'
import { Toast } from './components/shell/Toast'
import { HomePage } from './components/home/HomePage'
import { InventoryPage } from './components/inventory/InventoryPage'
import { ProbePage } from './components/probe/ProbePage'
import { SessionPage } from './components/session/SessionPage'

export default function App() {
  const mode = useStore((s) => s.mode)
  const setMode = useStore((s) => s.setMode)
  const loading = useStore((s) => s.loading)
  const setSources = useStore((s) => s.setSources)
  const setLoading = useStore((s) => s.setLoading)
  const sources = useStore((s) => s.sources)
  const currentProject = useStore((s) => s.currentProject)
  const setCurrentProject = useStore((s) => s.setCurrentProject)
  const setDetailSelection = useStore((s) => s.setDetailSelection)
  const toggleDetail = useStore((s) => s.toggleDetail)
  const setThemeMode = useStore((s) => s.setThemeMode)

  const { setMode: setThemeCssMode } = useTheme()
  const handleThemeChange = useCallback(
    (m: 'dark' | 'light' | 'system') => {
      setThemeMode(m)
      setThemeCssMode(m)
    },
    [setThemeMode, setThemeCssMode],
  )

  // Bootstrap: fetch project, sources, wire listeners
  useEffect(() => {
    window.api.getCurrentProject().then(setCurrentProject)
    window.api.getContextSources().then((result) => {
      setSources(result)
      setLoading(false)
    })
    const unsubContext = window.api.onContextUpdate(setSources)
    const unsubTheme = window.api.onSetTheme((m) => handleThemeChange(m as 'dark' | 'light' | 'system'))
    return () => {
      unsubContext()
      unsubTheme()
    }
  }, [setCurrentProject, setSources, setLoading, handleThemeChange])

  // Keyboard shortcuts: ⌘I toggle drawer, ⌘1/⌘2/⌘3 mode switch
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      if (e.key === 'i') {
        e.preventDefault()
        toggleDetail()
      }
      if (e.key === '0') {
        e.preventDefault()
        setMode('home')
      }
      if (e.key === '1') {
        e.preventDefault()
        setMode('inventory')
      }
      if (e.key === '2') {
        e.preventDefault()
        setMode('probe')
      }
      if (e.key === '3') {
        e.preventDefault()
        setMode('session')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleDetail, setMode])

  const handleSwitchProject = useCallback(
    async (projectPath: string) => {
      setDetailSelection(null)
      setCurrentProject(projectPath)
      const newSources = await window.api.switchProject(projectPath)
      setSources(newSources)
    },
    [setDetailSelection, setCurrentProject, setSources],
  )

  if (loading && sources.length === 0) {
    return (
      <div className="h-screen bg-surface text-content-primary flex items-center justify-center">
        <p className="text-content-muted">Scanning context sources…</p>
      </div>
    )
  }

  return (
    <div className="h-screen bg-surface text-content-primary flex flex-col overflow-hidden">
      <HeaderBar currentProject={currentProject} onSwitchProject={handleSwitchProject} />
      <div className="flex-1 flex overflow-hidden">
        <ModeSidebar mode={mode} onChange={setMode} />

        {mode === 'home' && <HomePage />}
        {mode === 'inventory' && <InventoryPage />}
        {mode === 'probe' && <ProbePage />}
        {mode === 'session' && <SessionPage />}
      </div>
      <Toast />
    </div>
  )
}
