import { app } from 'electron'
import { autoUpdater } from 'electron-updater'

export function initAutoUpdater(): void {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('error', (err) => {
    console.error('[auto-updater] error:', err)
  })

  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.error('[auto-updater] check failed:', err)
  })
}
