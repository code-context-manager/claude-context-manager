import { readFile, writeFile, rename, unlink } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import {
  computeRegistrationRemoval,
  computeRegistrationUpdate,
  type SelfRegistrationConfig,
} from '../core/mcp-self-register'
import { getUserClaudeJsonPath } from '../core/path-utils'

/**
 * Resolve the absolute path to the bundled MCP server entry. Two cases:
 *
 * - Packaged: the file lives under `app.asar.unpacked` because `asarUnpack`
 *   is set for `out/mcp/**` (it must be — the MCP is spawned as a child
 *   process and child processes can't be inside the asar archive).
 * - Dev: `app.getAppPath()` returns the project root, where `pnpm install`'s
 *   `postinstall` builds `out/mcp/index.mjs`.
 *
 * Either way, returns an absolute path that Claude Code can hand to `node`.
 */
export function resolveMcpEntryPath(): string {
  const appPath = app.getAppPath()
  const root = app.isPackaged ? appPath.replace(/app\.asar$/, 'app.asar.unpacked') : appPath
  return join(root, 'out', 'mcp', 'index.mjs')
}

function expectedConfig(): SelfRegistrationConfig {
  return {
    type: 'stdio',
    command: 'node',
    args: [resolveMcpEntryPath()],
  }
}

async function readIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

/**
 * Atomic write via tmp + rename. On Node 10+ rename replaces an existing
 * target on Windows too. If the rename fails, we try to clean up the tmp
 * to avoid littering the user's home directory.
 */
async function atomicWrite(path: string, content: string): Promise<void> {
  const tmp = `${path}.${process.pid}.tmp`
  try {
    await writeFile(tmp, content, 'utf-8')
    await rename(tmp, path)
  } catch (err) {
    try {
      await unlink(tmp)
    } catch {
      // tmp may not exist if writeFile itself failed; ignore.
    }
    throw err
  }
}

/**
 * Ensure `~/.claude.json` registers the bundled MCP server at user scope.
 * Idempotent. Safe to call on every app launch — only writes when the
 * existing entry is missing or stale.
 */
export async function ensureSelfRegistration(): Promise<void> {
  const path = getUserClaudeJsonPath()
  const current = await readIfExists(path)
  const update = computeRegistrationUpdate(current, expectedConfig())
  if (!update.changed || update.nextContent === null) return
  await atomicWrite(path, update.nextContent)
}

/**
 * Remove the self-registration entry. Invoked from the `--cleanup-mcp-registration`
 * CLI flag, which is wired into uninstall hooks (NSIS, Homebrew cask, deb, scoop).
 */
export async function removeSelfRegistration(): Promise<void> {
  const path = getUserClaudeJsonPath()
  const current = await readIfExists(path)
  const removal = computeRegistrationRemoval(current)
  if (!removal.changed || removal.nextContent === null) return
  await atomicWrite(path, removal.nextContent)
}
