import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // Inventory
  getContextSources: () => ipcRenderer.invoke('get-context-sources'),

  // File access
  getFileContent: (filePath: string) => ipcRenderer.invoke('get-file-content', filePath),
  listOpenOptions: () => ipcRenderer.invoke('list-open-options'),
  openFileWith: (filePath: string, optionId: string) =>
    ipcRenderer.invoke('open-file-with', filePath, optionId),

  // Projects
  getProjects: () => ipcRenderer.invoke('get-projects'),
  switchProject: (projectPath: string) => ipcRenderer.invoke('switch-project', projectPath),
  getCurrentProject: () => ipcRenderer.invoke('get-current-project'),

  // Probe
  probeFile: (targetPath: string) => ipcRenderer.invoke('probe-file', targetPath),
  listProjectFiles: () => ipcRenderer.invoke('list-project-files'),

  // Session
  listSessions: () => ipcRenderer.invoke('list-sessions'),
  getLatestSessionId: () => ipcRenderer.invoke('get-latest-session-id'),
  getSessionView: (sessionId: string) => ipcRenderer.invoke('get-session-view', sessionId),
  stopSessionWatch: () => ipcRenderer.invoke('stop-session-watch'),

  // Playbook
  getPlaybookEntries: () => ipcRenderer.invoke('get-playbook-entries'),

  // Events
  onContextUpdate: (callback: (sources: unknown) => void) => {
    ipcRenderer.on('context-update', (_event, sources) => callback(sources))
    return () => {
      ipcRenderer.removeAllListeners('context-update')
    }
  },
  onSessionUpdate: (callback: (sessionId: string) => void) => {
    ipcRenderer.on('session-update', (_event, sessionId: string) => callback(sessionId))
    return () => {
      ipcRenderer.removeAllListeners('session-update')
    }
  },
  onSessionListUpdate: (callback: () => void) => {
    ipcRenderer.on('session-list-update', () => callback())
    return () => {
      ipcRenderer.removeAllListeners('session-list-update')
    }
  },
  onSetTheme: (callback: (mode: string) => void) => {
    ipcRenderer.on('set-theme', (_event, mode) => callback(mode))
    return () => {
      ipcRenderer.removeAllListeners('set-theme')
    }
  },
})
