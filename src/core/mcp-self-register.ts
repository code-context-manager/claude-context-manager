/**
 * Pure logic for the app's self-registration of its bundled MCP server at
 * user scope in `~/.claude.json`.
 *
 * Why this lives in core/: per .claude/rules/shared-parsers-tested.md, string
 * transforms over Claude Code's file formats are tested in isolation. The
 * actual file read/write is handled in the main process — these functions
 * take the current JSON content and return the next content.
 *
 * The framing: registration is plumbing, not context. The app auto-manages
 * MCP wiring (convention-over-configuration) but never edits content the
 * user reasons about (memory, CLAUDE.md, playbook entries).
 */

export const SELF_REGISTRATION_NAME = 'claude-context-manager'

export interface SelfRegistrationConfig {
  type: 'stdio'
  command: string
  args: string[]
}

export interface RegistrationUpdate {
  /** Next JSON content to write. `null` means no change required. */
  nextContent: string | null
  /** Whether the on-disk file should be (re)written. */
  changed: boolean
  /** Reason, for logging. */
  reason: 'absent' | 'stale' | 'idempotent' | 'fresh-file'
}

/**
 * Compute the JSON content needed so that `~/.claude.json` has a top-level
 * `mcpServers["claude-context-manager"]` entry matching `expected`.
 *
 * - Idempotent: if the entry already matches, returns `changed: false`.
 * - Preserves all other top-level keys and other `mcpServers` entries.
 * - Handles missing file (returns a minimal JSON object).
 * - Tolerates a corrupt file by leaving it untouched and reporting `changed: false`.
 *   We refuse to overwrite something we can't parse — that's user data.
 */
export function computeRegistrationUpdate(
  currentContent: string | null,
  expected: SelfRegistrationConfig,
): RegistrationUpdate {
  if (currentContent === null) {
    const next = { mcpServers: { [SELF_REGISTRATION_NAME]: expected } }
    return {
      nextContent: stringify(next),
      changed: true,
      reason: 'fresh-file',
    }
  }

  let parsed: Record<string, unknown>
  try {
    const data = JSON.parse(currentContent)
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { nextContent: null, changed: false, reason: 'idempotent' }
    }
    parsed = data as Record<string, unknown>
  } catch {
    return { nextContent: null, changed: false, reason: 'idempotent' }
  }

  const mcpServers = isPlainObject(parsed.mcpServers)
    ? { ...(parsed.mcpServers as Record<string, unknown>) }
    : {}
  const existing = mcpServers[SELF_REGISTRATION_NAME]
  const reason: RegistrationUpdate['reason'] =
    existing === undefined
      ? 'absent'
      : configsEqual(existing, expected)
        ? 'idempotent'
        : 'stale'

  if (reason === 'idempotent') {
    return { nextContent: null, changed: false, reason }
  }

  mcpServers[SELF_REGISTRATION_NAME] = expected
  const next = { ...parsed, mcpServers }
  return { nextContent: stringify(next), changed: true, reason }
}

export interface RegistrationRemoval {
  /** Next JSON content to write. `null` means leave the file alone. */
  nextContent: string | null
  changed: boolean
  reason: 'absent' | 'removed' | 'no-file' | 'unparseable'
}

/**
 * Compute the JSON content needed to remove the self-registration entry.
 * Used by the uninstall hook. Idempotent and gentle: if the file is
 * missing, unparseable, or the entry isn't there, do nothing.
 */
export function computeRegistrationRemoval(
  currentContent: string | null,
): RegistrationRemoval {
  if (currentContent === null) {
    return { nextContent: null, changed: false, reason: 'no-file' }
  }

  let parsed: Record<string, unknown>
  try {
    const data = JSON.parse(currentContent)
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { nextContent: null, changed: false, reason: 'unparseable' }
    }
    parsed = data as Record<string, unknown>
  } catch {
    return { nextContent: null, changed: false, reason: 'unparseable' }
  }

  if (!isPlainObject(parsed.mcpServers)) {
    return { nextContent: null, changed: false, reason: 'absent' }
  }

  const mcpServers = { ...(parsed.mcpServers as Record<string, unknown>) }
  if (!(SELF_REGISTRATION_NAME in mcpServers)) {
    return { nextContent: null, changed: false, reason: 'absent' }
  }

  delete mcpServers[SELF_REGISTRATION_NAME]
  const next = { ...parsed, mcpServers }
  return { nextContent: stringify(next), changed: true, reason: 'removed' }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function configsEqual(a: unknown, b: SelfRegistrationConfig): boolean {
  if (!isPlainObject(a)) return false
  if (a.type !== b.type) return false
  if (a.command !== b.command) return false
  const aArgs = a.args
  if (!Array.isArray(aArgs)) return false
  if (aArgs.length !== b.args.length) return false
  for (let i = 0; i < aArgs.length; i++) {
    if (aArgs[i] !== b.args[i]) return false
  }
  return true
}

function stringify(value: unknown): string {
  return JSON.stringify(value, null, 2) + '\n'
}
