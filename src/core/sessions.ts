import { basename, join } from 'path'
import type { SessionSummary } from './types'
import { familyDataDirs } from './project-family'
import type { FsReader } from './fs'

/**
 * List all past session transcripts for a project, across the whole project
 * family (main checkout + git-worktree checkouts). Session JSONL files live at
 * `~/.claude/projects/<encoded-path>/*.jsonl`; worktrees get their own encoded
 * dir, so a repo-scoped list must scan every family dir or it silently drops
 * the sessions that ran inside worktrees.
 */
export async function listSessionsForProject(
  fs: FsReader,
  projectPath: string,
): Promise<SessionSummary[]> {
  const dirs = await familyDataDirs(fs, projectPath)
  const perDir = await Promise.all(
    dirs.map(async (dir) => {
      const entries = await fs.readdir(dir)
      if (!entries) return []
      const jsonlFiles = entries.filter((e) => e.endsWith('.jsonl'))
      return Promise.all(
        jsonlFiles.map(async (file): Promise<SessionSummary | null> => {
          const filePath = join(dir, file)
          const st = await fs.stat(filePath)
          if (!st || !st.isFile) return null
          const raw = await fs.readFile(filePath)
          if (raw === null) return null
          const { startedAt, endedAt, messageCount, firstPrompt } = summarize(raw)
          return {
            id: basename(file, '.jsonl'),
            filePath,
            startedAt: startedAt ?? st.birthtimeMs ?? null,
            endedAt: endedAt ?? st.mtimeMs ?? null,
            messageCount,
            firstPrompt,
          }
        }),
      )
    }),
  )

  // Dedupe by session id — the same transcript can be reached via both the
  // literal data dir and the family scan; keep the most-recently-ended copy.
  const byId = new Map<string, SessionSummary>()
  for (const summary of perDir.flat()) {
    if (summary === null) continue
    const existing = byId.get(summary.id)
    if (!existing || (summary.endedAt ?? 0) > (existing.endedAt ?? 0)) {
      byId.set(summary.id, summary)
    }
  }

  return [...byId.values()].sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
}

interface JsonlLine {
  type?: string
  timestamp?: string
  message?: { content?: unknown }
}

function summarize(raw: string): {
  startedAt: number | null
  endedAt: number | null
  messageCount: number
  firstPrompt: string | null
} {
  let startedAt: number | null = null
  let endedAt: number | null = null
  let messageCount = 0
  let firstPrompt: string | null = null

  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    let obj: JsonlLine
    try {
      obj = JSON.parse(line) as JsonlLine
    } catch {
      continue
    }
    const ts = obj.timestamp ? Date.parse(obj.timestamp) : NaN
    if (Number.isFinite(ts)) {
      if (startedAt === null || ts < startedAt) startedAt = ts
      if (endedAt === null || ts > endedAt) endedAt = ts
    }
    if (obj.type === 'user' || obj.type === 'assistant') messageCount++
    if (obj.type === 'user' && firstPrompt === null) {
      const c = obj.message?.content
      const text = flatten(c)
      if (text && !isToolResultOnly(c)) firstPrompt = truncate(text, 120)
    }
  }
  return { startedAt, endedAt, messageCount, firstPrompt }
}

function flatten(c: unknown): string | null {
  if (!c) return null
  if (typeof c === 'string') return c
  if (!Array.isArray(c)) return null
  const parts: string[] = []
  for (const b of c) {
    if (typeof b === 'string') parts.push(b)
    else if (b && typeof b === 'object' && typeof (b as { text?: unknown }).text === 'string') {
      parts.push((b as { text: string }).text)
    }
  }
  const joined = parts.join(' ').trim()
  return joined.length > 0 ? joined : null
}

function isToolResultOnly(c: unknown): boolean {
  if (!Array.isArray(c)) return false
  return c.every((b) => typeof b === 'object' && b && (b as { type?: string }).type === 'tool_result')
}

function truncate(s: string, n: number): string {
  const flat = s.replace(/\s+/g, ' ').trim()
  return flat.length > n ? flat.slice(0, n - 1) + '…' : flat
}
