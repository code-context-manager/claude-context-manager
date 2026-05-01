import type { FsReader } from './fs'

// ── Types ───────────────────────────────────────────────────────────────

export type PlaybookCategory = 'approach' | 'tool'
export type PlaybookMaturity = 'emerging' | 'established' | 'deprecated'

export type PlaybookDetect =
  | { kind: 'file_exists'; path: string }
  | { kind: 'file_contains'; path: string; contains: string }
  | {
      kind: 'package_installed'
      name: string
      ecosystem?: 'npm' | 'pip' | 'cargo' | 'go'
    }
  | { kind: 'mcp_server_configured'; name: string }

export interface PlaybookLink {
  label: string
  url: string
}

export interface PlaybookEntry {
  id: string
  category: PlaybookCategory
  title: string
  tagline: string
  description: string
  links: PlaybookLink[]
  detect?: PlaybookDetect[]
  tags?: string[]
  maturity?: PlaybookMaturity
  submitted_by?: string
  submitted_at?: string
  /** Filename or path where the entry was loaded from. */
  sourcePath: string
}

export type PlaybookSource = 'local' | 'cache' | 'remote' | 'none'

export interface PlaybookLoadResult {
  entries: PlaybookEntry[]
  errors: { sourcePath: string; message: string }[]
  source: PlaybookSource
  /** Resolved local root, when source === 'local'. */
  rootPath: string | null
}

// ── YAML subset parser ─────────────────────────────────────────────────
// The Playbook YAML files use a constrained subset:
//   - top-level scalar pairs:        `key: value`
//   - quoted scalars:                `key: "value"`
//   - block literal scalars:         `key: |` + indented body
//   - flow sequence of scalars:      `key: [a, b, c]`
//   - block sequence of flow maps:   `key:\n  - { k: v, k2: "v2" }`
// This is *not* a general YAML parser — it rejects shapes outside that
// subset rather than guessing.

type YamlValue = string | string[] | Record<string, string>[] | boolean

function parseFlowScalar(raw: string): string {
  const s = raw.trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1)
  }
  return s
}

function parseFlowArray(raw: string): string[] {
  // raw is the contents between [ and ], scalars only
  const inner = raw.trim().replace(/^\[/, '').replace(/\]$/, '').trim()
  if (inner === '') return []
  return inner.split(',').map((s) => parseFlowScalar(s))
}

function parseFlowMap(raw: string): Record<string, string> {
  // raw is `{ k1: v1, k2: "v2, with comma" }`
  const inner = raw.trim().replace(/^\{/, '').replace(/\}$/, '').trim()
  const out: Record<string, string> = {}
  if (inner === '') return out

  // Split on commas that aren't inside quotes.
  const parts: string[] = []
  let buf = ''
  let quote: '"' | "'" | null = null
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i]
    if (quote) {
      buf += c
      if (c === quote) quote = null
      continue
    }
    if (c === '"' || c === "'") {
      quote = c
      buf += c
      continue
    }
    if (c === ',') {
      parts.push(buf)
      buf = ''
      continue
    }
    buf += c
  }
  if (buf.trim() !== '') parts.push(buf)

  for (const part of parts) {
    const colonIdx = part.indexOf(':')
    if (colonIdx === -1) continue
    const key = part.slice(0, colonIdx).trim()
    const val = parseFlowScalar(part.slice(colonIdx + 1))
    out[key] = val
  }
  return out
}

function indentOf(line: string): number {
  let n = 0
  while (n < line.length && line[n] === ' ') n++
  return n
}

export function parsePlaybookYaml(yaml: string): Record<string, YamlValue> {
  const lines = yaml.split('\n')
  const out: Record<string, YamlValue> = {}
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '' || line.trim().startsWith('#')) {
      i++
      continue
    }
    if (indentOf(line) !== 0) {
      // Stray indented content with no parent we recognized — skip.
      i++
      continue
    }

    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) {
      i++
      continue
    }

    const key = line.slice(0, colonIdx).trim()
    const rest = line.slice(colonIdx + 1).trim()

    if (rest === '|' || rest === '|-') {
      // Block literal — collect indented lines.
      const collected: string[] = []
      i++
      let blockIndent: number | null = null
      while (i < lines.length) {
        const l = lines[i]
        if (l.trim() === '') {
          collected.push('')
          i++
          continue
        }
        const ind = indentOf(l)
        if (ind === 0) break
        if (blockIndent === null) blockIndent = ind
        collected.push(l.slice(blockIndent))
        i++
      }
      // Trim trailing blanks; preserve internal ones.
      while (collected.length > 0 && collected[collected.length - 1] === '') {
        collected.pop()
      }
      out[key] = collected.join('\n')
      continue
    }

    if (rest === '') {
      // Block sequence — read indented `- ...` lines.
      const items: (string | Record<string, string>)[] = []
      i++
      while (i < lines.length) {
        const l = lines[i]
        if (l.trim() === '' || l.trim().startsWith('#')) {
          i++
          continue
        }
        const ind = indentOf(l)
        if (ind === 0) break
        const trimmed = l.trim()
        if (!trimmed.startsWith('-')) break
        const itemRaw = trimmed.slice(1).trim()
        if (itemRaw.startsWith('{')) {
          items.push(parseFlowMap(itemRaw))
        } else {
          items.push(parseFlowScalar(itemRaw))
        }
        i++
      }
      // Decide shape: all-string vs all-map. Mixed → keep as strings.
      if (items.every((it) => typeof it === 'object')) {
        out[key] = items as Record<string, string>[]
      } else {
        out[key] = items.map((it) => (typeof it === 'string' ? it : JSON.stringify(it)))
      }
      continue
    }

    if (rest.startsWith('[')) {
      out[key] = parseFlowArray(rest)
      i++
      continue
    }

    // Scalar.
    if (rest === 'true') out[key] = true
    else if (rest === 'false') out[key] = false
    else out[key] = parseFlowScalar(rest)
    i++
  }

  return out
}

// ── Entry validation ───────────────────────────────────────────────────

function asString(v: YamlValue | undefined): string | undefined {
  return typeof v === 'string' ? v : undefined
}

function asStringArray(v: YamlValue | undefined): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  if (v.length > 0 && typeof v[0] !== 'string') return undefined
  return v as string[]
}

function asMapArray(v: YamlValue | undefined): Record<string, string>[] | undefined {
  if (!Array.isArray(v)) return undefined
  if (v.length === 0) return []
  if (typeof v[0] === 'string') return undefined
  return v as Record<string, string>[]
}

function coerceDetect(maps: Record<string, string>[]): PlaybookDetect[] {
  const out: PlaybookDetect[] = []
  for (const m of maps) {
    if (m.kind === 'file_exists' && m.path) {
      out.push({ kind: 'file_exists', path: m.path })
    } else if (m.kind === 'file_contains' && m.path && m.contains) {
      out.push({ kind: 'file_contains', path: m.path, contains: m.contains })
    } else if (m.kind === 'package_installed' && m.name) {
      const eco = m.ecosystem
      const ecosystem =
        eco === 'npm' || eco === 'pip' || eco === 'cargo' || eco === 'go' ? eco : undefined
      out.push({ kind: 'package_installed', name: m.name, ecosystem })
    } else if (m.kind === 'mcp_server_configured' && m.name) {
      out.push({ kind: 'mcp_server_configured', name: m.name })
    }
  }
  return out
}

export function parsePlaybookEntry(
  yaml: string,
  sourcePath: string,
): { ok: true; entry: PlaybookEntry } | { ok: false; error: string } {
  let raw: Record<string, YamlValue>
  try {
    raw = parsePlaybookYaml(yaml)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  const id = asString(raw.id)
  const category = asString(raw.category)
  const title = asString(raw.title)
  const tagline = asString(raw.tagline)
  const description = asString(raw.description)
  const linksRaw = asMapArray(raw.links)

  if (!id) return { ok: false, error: 'missing id' }
  if (category !== 'approach' && category !== 'tool') {
    return { ok: false, error: `invalid category: ${category ?? '<missing>'}` }
  }
  if (!title) return { ok: false, error: 'missing title' }
  if (!tagline) return { ok: false, error: 'missing tagline' }
  if (!description) return { ok: false, error: 'missing description' }
  if (!linksRaw || linksRaw.length === 0) return { ok: false, error: 'missing links' }

  const links: PlaybookLink[] = []
  for (const l of linksRaw) {
    if (l.label && l.url) links.push({ label: l.label, url: l.url })
  }
  if (links.length === 0) return { ok: false, error: 'no valid links' }

  const detectRaw = asMapArray(raw.detect)
  const detect = detectRaw ? coerceDetect(detectRaw) : undefined

  const tags = asStringArray(raw.tags)
  const maturityRaw = asString(raw.maturity)
  const maturity: PlaybookMaturity | undefined =
    maturityRaw === 'emerging' || maturityRaw === 'established' || maturityRaw === 'deprecated'
      ? maturityRaw
      : undefined

  return {
    ok: true,
    entry: {
      id,
      category,
      title,
      tagline,
      description,
      links,
      detect: detect && detect.length > 0 ? detect : undefined,
      tags,
      maturity,
      submitted_by: asString(raw.submitted_by),
      submitted_at: asString(raw.submitted_at),
      sourcePath,
    },
  }
}

// ── Local loader ───────────────────────────────────────────────────────

const ENTRY_DIRS = ['entries/approaches', 'entries/tools'] as const

function joinPath(a: string, b: string): string {
  if (a.endsWith('/')) return a + b
  return a + '/' + b
}

/**
 * Read every `entries/**\/*.yml` from a local checkout of the Playbook repo.
 * Errors on individual files are collected, not thrown — one bad entry
 * shouldn't blank the whole list.
 */
export async function loadPlaybookFromLocal(
  fs: FsReader,
  rootPath: string,
): Promise<PlaybookLoadResult> {
  const entries: PlaybookEntry[] = []
  const errors: { sourcePath: string; message: string }[] = []

  const rootStat = await fs.stat(rootPath)
  if (!rootStat || !rootStat.isDirectory) {
    return { entries: [], errors: [], source: 'none', rootPath: null }
  }

  for (const sub of ENTRY_DIRS) {
    const dir = joinPath(rootPath, sub)
    const names = await fs.readdir(dir)
    if (!names) continue
    for (const name of names) {
      if (!name.endsWith('.yml') && !name.endsWith('.yaml')) continue
      const filePath = joinPath(dir, name)
      const content = await fs.readFile(filePath)
      if (content === null) {
        errors.push({ sourcePath: filePath, message: 'unreadable' })
        continue
      }
      const result = parsePlaybookEntry(content, filePath)
      if (result.ok) {
        entries.push(result.entry)
      } else {
        errors.push({ sourcePath: filePath, message: result.error })
      }
    }
  }

  entries.sort((a, b) => a.title.localeCompare(b.title))

  return { entries, errors, source: 'local', rootPath }
}
