import { shell, clipboard } from 'electron'
import { spawn, execFileSync } from 'child_process'
import { existsSync } from 'fs'
import { homedir } from 'os'
import { dirname, join } from 'path'

export interface OpenOption {
  id: string
  label: string
  primary?: boolean
}

interface ResolvedEditor {
  id: string
  label: string
  run: (filePath: string) => void
}

interface MacAppSpec {
  id: string
  label: string
  appName: string
}

const MAC_APPS: MacAppSpec[] = [
  { id: 'editor:vscode', label: 'VS Code', appName: 'Visual Studio Code' },
  { id: 'editor:cursor', label: 'Cursor', appName: 'Cursor' },
  { id: 'editor:sublime', label: 'Sublime Text', appName: 'Sublime Text' },
  { id: 'editor:webstorm', label: 'WebStorm', appName: 'WebStorm' },
  { id: 'editor:idea', label: 'IntelliJ IDEA', appName: 'IntelliJ IDEA' },
  { id: 'editor:zed', label: 'Zed', appName: 'Zed' },
]

interface PathToolSpec {
  id: string
  label: string
  command: string
}

const PATH_TOOLS: PathToolSpec[] = [
  { id: 'editor:vscode', label: 'VS Code', command: 'code' },
  { id: 'editor:cursor', label: 'Cursor', command: 'cursor' },
  { id: 'editor:sublime', label: 'Sublime Text', command: 'subl' },
  { id: 'editor:webstorm', label: 'WebStorm', command: 'webstorm' },
  { id: 'editor:idea', label: 'IntelliJ IDEA', command: 'idea' },
  { id: 'editor:zed', label: 'Zed', command: 'zed' },
]

let editors: ResolvedEditor[] = []
let initialized = false

function macAppExists(appName: string): boolean {
  return (
    existsSync(`/Applications/${appName}.app`) ||
    existsSync(join(homedir(), 'Applications', `${appName}.app`))
  )
}

function whichExists(command: string): boolean {
  try {
    const tool = process.platform === 'win32' ? 'where' : 'which'
    execFileSync(tool, [command], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function init(): void {
  if (initialized) return
  initialized = true
  if (process.platform === 'darwin') {
    for (const app of MAC_APPS) {
      if (macAppExists(app.appName)) {
        editors.push({
          id: app.id,
          label: `Open in ${app.label}`,
          run: (filePath) => {
            spawn('open', ['-a', app.appName, filePath], {
              detached: true,
              stdio: 'ignore',
            }).unref()
          },
        })
      }
    }
  } else {
    for (const tool of PATH_TOOLS) {
      if (whichExists(tool.command)) {
        editors.push({
          id: tool.id,
          label: `Open in ${tool.label}`,
          run: (filePath) => {
            spawn(tool.command, [filePath], { detached: true, stdio: 'ignore' }).unref()
          },
        })
      }
    }
  }
}

function revealLabel(): string {
  if (process.platform === 'darwin') return 'Reveal in Finder'
  if (process.platform === 'win32') return 'Show in Explorer'
  return 'Show in file manager'
}

export function listOpenOptions(): OpenOption[] {
  init()
  const [topEditor, ...restEditors] = editors
  const list: OpenOption[] = []
  if (topEditor) list.push({ id: topEditor.id, label: topEditor.label })
  list.push({ id: 'reveal', label: revealLabel() })
  list.push(...restEditors.map((e) => ({ id: e.id, label: e.label })))
  list.push(
    { id: 'default', label: 'Open with default app' },
    { id: 'open-folder', label: 'Open containing folder' },
    { id: 'copy-path', label: 'Copy absolute path' },
  )
  return list
}

export async function openWith(filePath: string, optionId: string): Promise<void> {
  init()
  if (optionId === 'reveal') {
    shell.showItemInFolder(filePath)
    return
  }
  if (optionId === 'default') {
    await shell.openPath(filePath)
    return
  }
  if (optionId === 'open-folder') {
    await shell.openPath(dirname(filePath))
    return
  }
  if (optionId === 'copy-path') {
    clipboard.writeText(filePath)
    return
  }
  const editor = editors.find((e) => e.id === optionId)
  if (editor) {
    editor.run(filePath)
    return
  }
  throw new Error(`Unknown open option: ${optionId}`)
}
