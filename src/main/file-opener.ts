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

interface EditorSpec {
  id: string
  label: string
  mac?: { appName: string }
  cli?: { command: string }
}

const EDITORS: EditorSpec[] = [
  { id: 'editor:vscode', label: 'VS Code', mac: { appName: 'Visual Studio Code' }, cli: { command: 'code' } },
  { id: 'editor:cursor', label: 'Cursor', mac: { appName: 'Cursor' }, cli: { command: 'cursor' } },
  { id: 'editor:sublime', label: 'Sublime Text', mac: { appName: 'Sublime Text' }, cli: { command: 'subl' } },
  { id: 'editor:webstorm', label: 'WebStorm', mac: { appName: 'WebStorm' }, cli: { command: 'webstorm' } },
  { id: 'editor:idea', label: 'IntelliJ IDEA', mac: { appName: 'IntelliJ IDEA' }, cli: { command: 'idea' } },
  { id: 'editor:zed', label: 'Zed', mac: { appName: 'Zed' }, cli: { command: 'zed' } },
]

interface ResolvedEditor {
  id: string
  label: string
  run: (filePath: string) => Promise<void>
}

// Wrap a child process so we can await whether it actually launched.
// `error` fires (instead of `spawn`) when the binary can't be executed —
// e.g. ENOENT, EACCES, or Node's CVE-2024-27980 block on .cmd/.bat. Without
// this, fire-and-forget spawns swallow those errors.
function awaitSpawn(child: ReturnType<typeof spawn>): Promise<void> {
  return new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}

interface PlatformAdapter {
  revealLabel: string
  resolve(spec: EditorSpec): ResolvedEditor | null
}

const macAdapter: PlatformAdapter = {
  revealLabel: 'Reveal in Finder',
  resolve(spec) {
    if (!spec.mac) return null
    const { appName } = spec.mac
    const found =
      existsSync(`/Applications/${appName}.app`) ||
      existsSync(join(homedir(), 'Applications', `${appName}.app`))
    if (!found) return null
    return {
      id: spec.id,
      label: `Open in ${spec.label}`,
      run: (filePath) =>
        awaitSpawn(
          spawn('open', ['-a', appName, filePath], { detached: true, stdio: 'ignore' }),
        ),
    }
  },
}

// Resolve a CLI command to an absolute path that `spawn` (without a shell) can
// execute directly.
//
// Why this is fiddly on Windows:
//   1. `spawn('code', …)` without `shell:true` only matches an exact filename —
//      it does not honor PATHEXT, so `.cmd`/`.bat` shims fail with ENOENT.
//   2. `where code` returns ALL matches, and tools like VS Code ship both an
//      extensionless bash script (`…\bin\code`, for git-bash/WSL) and a
//      Windows batch shim (`…\bin\code.cmd`). The bash script appears first
//      but is not executable by Windows directly — we must pick the entry
//      whose extension is in PATHEXT.
function whichResolve(command: string): string | null {
  const tool = process.platform === 'win32' ? 'where' : 'which'
  try {
    const out = execFileSync(tool, [command], {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString()
    const lines = out
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (lines.length === 0) return null
    if (process.platform !== 'win32') return lines[0]
    const pathext = (process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD')
      .split(';')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
    const executable = lines.find((line) => {
      const dot = line.lastIndexOf('.')
      if (dot < 0) return false
      return pathext.includes(line.slice(dot).toLowerCase())
    })
    return executable ?? null
  } catch {
    return null
  }
}

// Launch a resolved CLI absolute path with one file argument.
// On Windows, `.cmd`/`.bat` shims cannot be spawned directly since Node 20
// (CVE-2024-27980) — they must go through cmd.exe. We invoke cmd.exe ourselves
// with `windowsVerbatimArguments` rather than `shell:true` so the quoting is
// explicit and survives paths with spaces or `&`-like characters.
function runResolved(resolved: string, filePath: string): Promise<void> {
  const isWinBatch = process.platform === 'win32' && /\.(cmd|bat)$/i.test(resolved)
  const child = isWinBatch
    ? spawn(
        'cmd.exe',
        ['/d', '/s', '/c', `"${resolved.replace(/"/g, '""')}" "${filePath.replace(/"/g, '""')}"`],
        { detached: true, stdio: 'ignore', windowsVerbatimArguments: true },
      )
    : spawn(resolved, [filePath], { detached: true, stdio: 'ignore' })
  return awaitSpawn(child)
}

const cliAdapter: PlatformAdapter = {
  revealLabel: process.platform === 'win32' ? 'Show in Explorer' : 'Show in file manager',
  resolve(spec) {
    if (!spec.cli) return null
    const resolved = whichResolve(spec.cli.command)
    if (!resolved) return null
    return {
      id: spec.id,
      label: `Open in ${spec.label}`,
      run: (filePath) => runResolved(resolved, filePath),
    }
  },
}

function getAdapter(): PlatformAdapter {
  return process.platform === 'darwin' ? macAdapter : cliAdapter
}

let editors: ResolvedEditor[] = []
let initialized = false

function init(): void {
  if (initialized) return
  initialized = true
  const adapter = getAdapter()
  for (const spec of EDITORS) {
    const resolved = adapter.resolve(spec)
    if (resolved) editors.push(resolved)
  }
}

export function listOpenOptions(): OpenOption[] {
  init()
  const [topEditor, ...restEditors] = editors
  const list: OpenOption[] = []
  if (topEditor) list.push({ id: topEditor.id, label: topEditor.label })
  list.push({ id: 'reveal', label: getAdapter().revealLabel })
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
    await editor.run(filePath)
    return
  }
  throw new Error(`Unknown open option: ${optionId}`)
}
