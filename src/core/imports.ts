import { homedir } from 'os'
import { dirname, isAbsolute, join, resolve } from 'path'
import type { FsReader } from './fs'
import { estimateTokens } from './token-estimator'

/**
 * One file pulled into context by a CLAUDE.md `@path` import. Imported files
 * are expanded and loaded at launch alongside the CLAUDE.md that references
 * them, so their tokens count against the same budget.
 */
export interface ClaudeMdImport {
  /** Absolute path to the imported file. */
  filePath: string
  /** Token estimate of the imported file's content. */
  tokens: number
  /** Absolute path of the file whose `@` reference pulled this one in. */
  importedBy: string
}

/** Claude Code caps import expansion at four hops. */
const MAX_IMPORT_DEPTH = 4

/**
 * Strip fenced code blocks and inline code spans before scanning for imports.
 * An `@path` inside a code example is documentation, not an import, and `@`
 * also shows up in unrelated places (emails, npm scopes) — the leading
 * whitespace anchor plus code stripping keeps false positives down.
 */
function stripCode(md: string): string {
  return md.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '')
}

const IMPORT_RE = /(?:^|\s)@(\S+)/g

/** Resolve an `@`-import spec to an absolute path. Relative specs resolve
 *  against the *importing file's* directory, not the working directory. */
function resolveImportPath(spec: string, containingFile: string): string {
  if (spec === '~') return homedir()
  if (spec.startsWith('~/')) return join(homedir(), spec.slice(2))
  if (isAbsolute(spec)) return spec
  return resolve(dirname(containingFile), spec)
}

/**
 * Expand the `@path` imports referenced (recursively, depth ≤ 4) by a
 * CLAUDE.md body. Returns one entry per distinct readable imported file, in
 * first-encountered order. Unreadable specs (a stray `@word`, a missing path)
 * are silently skipped — they aren't real imports. Cycles and re-imports are
 * de-duplicated by absolute path.
 */
export async function resolveClaudeMdImports(
  fs: FsReader,
  body: string,
  containingFile: string,
): Promise<ClaudeMdImport[]> {
  const out: ClaudeMdImport[] = []
  const visited = new Set<string>([resolve(containingFile)])

  async function walk(text: string, fromFile: string, depth: number): Promise<void> {
    if (depth >= MAX_IMPORT_DEPTH) return
    const scanned = stripCode(text)
    for (const m of scanned.matchAll(IMPORT_RE)) {
      const spec = m[1].replace(/[.,;:!?)\]]+$/, '')
      if (!spec) continue
      const target = resolveImportPath(spec, fromFile)
      if (visited.has(target)) continue
      visited.add(target)
      const content = await fs.readFile(target)
      if (content === null) continue
      out.push({ filePath: target, tokens: estimateTokens(content), importedBy: fromFile })
      await walk(content, target, depth + 1)
    }
  }

  await walk(body, resolve(containingFile), 0)
  return out
}
