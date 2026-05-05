import { app, BrowserWindow, Menu } from 'electron'
import { join } from 'path'
import { registerIpcHandlers, setProjectPath } from './ipc-handlers'
import { startWatching, stopWatching, startSessionListWatch } from './file-watcher'
import { initAutoUpdater } from './auto-updater'
import { ensureSelfRegistration, removeSelfRegistration } from './mcp-self-register'

const CLEANUP_FLAG = '--cleanup-mcp-registration'

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    title: 'Claude Context Manager',
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

function buildMenu(win: BrowserWindow): void {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Theme',
          submenu: [
            {
              label: 'System',
              type: 'radio',
              checked: true,
              click: () => win.webContents.send('set-theme', 'system'),
            },
            {
              label: 'Dark',
              type: 'radio',
              click: () => win.webContents.send('set-theme', 'dark'),
            },
            {
              label: 'Light',
              type: 'radio',
              click: () => win.webContents.send('set-theme', 'light'),
            },
          ],
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [{ type: 'separator' as const }, { role: 'front' as const }]
          : [{ role: 'close' as const }]),
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// Headless mode for uninstall hooks: short-circuit before any UI work.
// Wired up by NSIS uninstaller, Homebrew cask uninstall_postflight, .deb
// prerm, and Scoop's uninstall script. Removes our user-scope MCP entry
// from ~/.claude.json so we don't leave orphaned wiring behind.
if (process.argv.includes(CLEANUP_FLAG)) {
  app.whenReady().then(async () => {
    try {
      await removeSelfRegistration()
    } catch (err) {
      console.error('mcp-cleanup failed:', err)
    } finally {
      app.quit()
    }
  })
} else {
  app.whenReady().then(async () => {
    // Convention-over-configuration: register our bundled MCP server at user
    // scope so Claude Code picks it up in every project. Plumbing, not
    // context — see docs/state/facts.md.
    try {
      await ensureSelfRegistration()
    } catch (err) {
      console.error('mcp self-registration failed:', err)
    }

    // Default to CWD as the project path
    const projectPath = process.cwd()
    setProjectPath(projectPath)
    registerIpcHandlers()

    const win = createWindow()
    buildMenu(win)
    startWatching(projectPath, win)
    startSessionListWatch(projectPath, win)
    initAutoUpdater()
  })
}

app.on('window-all-closed', () => {
  stopWatching()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const projectPath = process.cwd()
    const win = createWindow()
    startWatching(projectPath, win)
    startSessionListWatch(projectPath, win)
  }
})
