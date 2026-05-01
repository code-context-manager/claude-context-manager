import { basename, dirname, join, relative, resolve, sep } from 'path'
import type {
  LoadedContextSnapshot,
  LoadedFile,
  LoadMechanism,
  LoadReason,
  SessionTree,
  SessionTreeNode,
  SessionView,
  StaticLoadEntry,
  StaticLoadResult,
} from './types'
import { getProjectDataDir } from './path-utils'
import { computeLoadedContext } from './loaded-context'
import { computeFileStaticLoad, computeProjectStaticLoad } from './static-load'
import type { FsReader } from './fs'
import type { ClaudeCli } from './claude-cli'

const DEFAULT_IGNORE = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  'coverage',
  '.next',
  '.turbo',
  '.cache',
  '__pycache__',
  '.venv',
  'venv',
  'target',
])

const MAX_TREE_DEPTH = 8
const MAX_TREE_ENTRIES = 5000

/** Return the most recently modified JSONL for a project, or null. */
export async function latestSessionId(
  fs: FsReader,
  projectPath: string,
): Promise<string | null> {
  const dir = getProjectDataDir(projectPath)
  const entries = await fs.readdir(dir)
  if (!entries) return null
  let best: { id: string; mtime: number } | null = null
  for (const entry of entries) {
    if (!entry.endsWith('.jsonl')) continue
    const st = await fs.stat(join(dir, entry))
    if (!st || !st.isFile) continue
    if (!best || st.mtimeMs > best.mtime) {
      best = { id: entry.replace(/\.jsonl$/, ''), mtime: st.mtimeMs }
    }
  }
  return best?.id ?? null
}

/**
 * Build the complete SessionView for a project + session: reduce the JSONL,
 * flag stale-since-read files, then walk the on-disk project tree and merge
 * the session-loaded annotations onto it. External-path reads (outside the
 * project root) are collected under separate roots.
 */
export async function buildSessionView(
  fs: FsReader,
  projectPath: string,
  sessionId: string,
  cli?: ClaudeCli,
): Promise<SessionView | null> {
  const jsonlPath = join(getProjectDataDir(projectPath), `${sessionId}.jsonl`)
  const raw = await fs.readFile(jsonlPath)
  if (raw === null) return null

  const snapshot = computeLoadedContext(raw, sessionId, projectPath)
  // Seed reasons from the JSONL evidence captured by the parser.
  for (const f of snapshot.files) f.reasons = mechanismsToToolCallReasons(f)

  // Layer the project-static bundle onto file-shaped entries (CLAUDE.mds,
  // MEMORY.md, rule files). Synthetic entries (system prompt, env info,
  // mcp-index) live elsewhere on the snapshot, not in `files`.
  const projectStatic = await computeProjectStaticLoad(fs, projectPath, cli)
  applyProjectStaticToFiles(snapshot, projectStatic)

  // For every file that arrived via tool-call evidence, ask "if this file
  // is in scope, what else does CC pull in?" and merge those. Memoize so
  // a session that touched 100 files in src/ doesn't re-walk the chain 100
  // times.
  const fileStaticCache = new Map<string, StaticLoadResult>()
  const seedFiles = snapshot.files.filter(
    (f) => f.reasons?.some((r) => r.kind === 'tool-call'),
  )
  for (const f of seedFiles) {
    const cached = fileStaticCache.get(f.path)
    const fileStatic = cached ?? (await computeFileStaticLoad(fs, projectPath, f.path))
    if (!cached) fileStaticCache.set(f.path, fileStatic)
    applyFileStaticToFiles(snapshot, fileStatic, f.path)
  }

  // Snapshot's claudeMdChain mirrors the file-shaped CLAUDE.mds with reasons.
  rebuildClaudeMdChain(snapshot)

  await annotateStale(fs, snapshot)
  const tree = await buildTree(fs, projectPath, snapshot)
  return { snapshot, tree }
}

function mechanismsToToolCallReasons(f: LoadedFile): LoadReason[] {
  const reasons: LoadReason[] = []
  for (const m of f.mechanisms) {
    if (m === 'read' || m === 'edit' || m === 'write') {
      reasons.push({ kind: 'tool-call', tool: m, lineIndex: f.lastLineIndex })
    }
  }
  return reasons
}

/**
 * Upsert each file-shaped project-static entry into snapshot.files. If the
 * file already exists (e.g. CLAUDE.md was also explicitly Read), append the
 * static reason; otherwise synthesize a new LoadedFile carrying the static
 * reason only.
 */
function applyProjectStaticToFiles(
  snapshot: LoadedContextSnapshot,
  result: StaticLoadResult,
): void {
  for (const e of result.entries) {
    if (!e.filePath) continue
    const reason: LoadReason =
      e.scope === 'global' ? { kind: 'global-static' } : { kind: 'project-static' }
    upsertEntry(snapshot, e, reason)
  }
  snapshot.files.sort((a, b) => a.path.localeCompare(b.path))
}

function applyFileStaticToFiles(
  snapshot: LoadedContextSnapshot,
  result: StaticLoadResult,
  triggeredBy: string,
): void {
  for (const e of result.entries) {
    if (!e.filePath) continue
    upsertEntry(snapshot, e, { kind: 'file-static', triggeredBy })
  }
  snapshot.files.sort((a, b) => a.path.localeCompare(b.path))
}

function upsertEntry(
  snapshot: LoadedContextSnapshot,
  entry: StaticLoadEntry,
  reason: LoadReason,
): void {
  const path = entry.filePath
  if (!path) return
  const existing = snapshot.files.find((f) => f.path === path)
  if (existing) {
    existing.reasons ??= []
    if (!hasReason(existing.reasons, reason)) existing.reasons.push(reason)
    // Don't overwrite tokens — JSONL-loaded content is more authoritative
    // than re-estimating from disk (Claude may have read a slice).
    if (existing.tokens === 0) existing.tokens = entry.tokens
    return
  }
  snapshot.files.push({
    path,
    name: basename(path),
    mechanisms: [staticMechanismFor(entry.kind)],
    readCount: 0,
    editCount: 0,
    writeCount: 0,
    firstLineIndex: -1,
    lastLineIndex: -1,
    lastLoadedAt: null,
    tokens: entry.tokens,
    lastLoadedSize: 0,
    reasons: [reason],
  })
}

function staticMechanismFor(kind: StaticLoadEntry['kind']): LoadMechanism {
  if (kind === 'memory') return 'memory-auto'
  if (kind === 'rule') return 'rule-auto'
  return 'claude-md-auto'
}

function hasReason(reasons: LoadReason[], r: LoadReason): boolean {
  for (const existing of reasons) {
    if (existing.kind !== r.kind) continue
    if (existing.kind === 'file-static' && r.kind === 'file-static') {
      if (existing.triggeredBy === r.triggeredBy) return true
    } else if (existing.kind === 'tool-call' && r.kind === 'tool-call') {
      if (existing.tool === r.tool && existing.lineIndex === r.lineIndex) return true
    } else {
      return true
    }
  }
  return false
}

function rebuildClaudeMdChain(snapshot: LoadedContextSnapshot): void {
  const chainPaths = new Set<string>()
  for (const f of snapshot.files) {
    if (!/CLAUDE\.md$/.test(f.path)) continue
    if (!f.reasons?.some((r) => r.kind !== 'tool-call')) continue
    chainPaths.add(f.path)
  }
  // Preserve any tool-call-only CLAUDE.md mentions (existing behavior).
  for (const e of snapshot.claudeMdChain) chainPaths.add(e.path)
  snapshot.claudeMdChain = Array.from(chainPaths)
    .sort()
    .map((path) => {
      const f = snapshot.files.find((x) => x.path === path)
      return { path, tokens: f?.tokens ?? 0 }
    })
}

async function annotateStale(fs: FsReader, snapshot: LoadedContextSnapshot): Promise<void> {
  await Promise.all(
    snapshot.files.map(async (file) => {
      const st = await fs.stat(file.path)
      if (!st) {
        // File no longer exists — treat as stale.
        file.staleSinceRead = true
        return
      }
      if (!st.isFile) return
      if (file.lastLoadedAt !== null && st.mtimeMs > file.lastLoadedAt + 1000) {
        file.staleSinceRead = true
      }
    }),
  )
}

async function buildTree(
  fs: FsReader,
  projectPath: string,
  snapshot: LoadedContextSnapshot,
): Promise<SessionTree> {
  const root = resolve(projectPath)
  const loadedByPath = new Map<string, LoadedFile>()
  for (const file of snapshot.files) loadedByPath.set(file.path, file)

  const projectRoot = await walkDir(fs, root, loadedByPath, 0)

  // Ensure every loaded file inside the project is present on the tree even
  // if the walker capped depth or skipped hidden dirs.
  for (const file of snapshot.files) {
    const absPath = resolve(file.path)
    if (isDescendant(absPath, root)) {
      ensurePathInTree(projectRoot, absPath, root, loadedByPath)
    }
  }

  // Group external reads by their root (e.g. /Users/foo/.claude/...).
  const externals = snapshot.files.filter((f) => !isDescendant(resolve(f.path), root))
  const externalRoots = buildExternalRoots(externals, loadedByPath)

  rollup(projectRoot)
  for (const ext of externalRoots) rollup(ext)

  return { projectRoot, externalRoots }
}

async function walkDir(
  fs: FsReader,
  dir: string,
  loadedByPath: Map<string, LoadedFile>,
  depth: number,
  entryCounter: { count: number } = { count: 0 },
): Promise<SessionTreeNode> {
  const name = basename(dir) || dir
  const node: SessionTreeNode = {
    name,
    path: dir,
    isDirectory: true,
    loaded: null,
    staleSinceRead: false,
    children: [],
    loadedTokensRollup: 0,
    loadedCountRollup: 0,
  }
  if (depth > MAX_TREE_DEPTH) return node
  if (entryCounter.count >= MAX_TREE_ENTRIES) return node

  const entries = await fs.readdirWithTypes(dir)
  if (!entries) return node

  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  for (const entry of entries) {
    if (entryCounter.count >= MAX_TREE_ENTRIES) break
    if (entry.name.startsWith('.') && entry.name !== '.claude') continue
    if (DEFAULT_IGNORE.has(entry.name)) continue
    const abs = join(dir, entry.name)
    entryCounter.count++
    if (entry.isDirectory) {
      const child = await walkDir(fs, abs, loadedByPath, depth + 1, entryCounter)
      node.children!.push(child)
    } else {
      node.children!.push(makeFileNode(abs, loadedByPath))
    }
  }

  return node
}

function makeFileNode(absPath: string, loadedByPath: Map<string, LoadedFile>): SessionTreeNode {
  const loaded = loadedByPath.get(absPath) ?? null
  const stale = loaded?.staleSinceRead === true
  return {
    name: basename(absPath),
    path: absPath,
    isDirectory: false,
    loaded,
    staleSinceRead: stale,
    loadedTokensRollup: loaded?.tokens ?? 0,
    loadedCountRollup: loaded ? 1 : 0,
  }
}

/** Graft a loaded file into the tree if the walker missed it. */
function ensurePathInTree(
  root: SessionTreeNode,
  absPath: string,
  rootPath: string,
  loadedByPath: Map<string, LoadedFile>,
): void {
  const rel = relative(rootPath, absPath)
  if (!rel || rel.startsWith('..')) return
  const segments = rel.split(sep).filter(Boolean)
  let cursor = root
  let curPath = rootPath
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    curPath = join(curPath, seg)
    const isLast = i === segments.length - 1
    cursor.children ??= []
    let next = cursor.children.find((c) => c.name === seg)
    if (!next) {
      if (isLast) {
        next = makeFileNode(curPath, loadedByPath)
      } else {
        next = {
          name: seg,
          path: curPath,
          isDirectory: true,
          loaded: null,
          staleSinceRead: false,
          children: [],
          loadedTokensRollup: 0,
          loadedCountRollup: 0,
        }
      }
      cursor.children.push(next)
    }
    cursor = next
  }
}

function buildExternalRoots(
  externals: LoadedFile[],
  loadedByPath: Map<string, LoadedFile>,
): SessionTreeNode[] {
  if (externals.length === 0) return []
  const grouped = new Map<string, LoadedFile[]>()
  for (const file of externals) {
    const root = externalRootFor(file.path)
    const bucket = grouped.get(root) ?? []
    bucket.push(file)
    grouped.set(root, bucket)
  }
  const roots: SessionTreeNode[] = []
  for (const [rootPath, files] of grouped) {
    const rootNode: SessionTreeNode = {
      name: rootPath,
      path: rootPath,
      isDirectory: true,
      loaded: null,
      staleSinceRead: false,
      children: [],
      loadedTokensRollup: 0,
      loadedCountRollup: 0,
    }
    for (const file of files) {
      ensurePathInTree(rootNode, file.path, rootPath, loadedByPath)
    }
    roots.push(rootNode)
  }
  return roots.sort((a, b) => a.path.localeCompare(b.path))
}

/** Pick a reasonable "root" for an external path so grouping stays readable.
 *  e.g. /Users/foo/.claude/projects/x.md → /Users/foo/.claude. */
function externalRootFor(path: string): string {
  if (path.includes('.claude')) {
    const idx = path.indexOf('.claude')
    const upTo = path.slice(0, idx + '.claude'.length)
    return upTo
  }
  // Fall back to the second-to-top ancestor so we don't dump everything at /.
  const parent = dirname(path)
  return parent === '/' || parent === '' ? path : parent
}

function isDescendant(path: string, root: string): boolean {
  if (path === root) return true
  const rel = relative(root, path)
  return !!rel && !rel.startsWith('..') && !resolve(root, rel).startsWith('..')
}

function rollup(node: SessionTreeNode): void {
  if (!node.children || node.children.length === 0) return
  let tokens = node.loaded?.tokens ?? 0
  let count = node.loaded ? 1 : 0
  for (const child of node.children) {
    rollup(child)
    tokens += child.loadedTokensRollup
    count += child.loadedCountRollup
  }
  node.loadedTokensRollup = tokens
  node.loadedCountRollup = count
}
