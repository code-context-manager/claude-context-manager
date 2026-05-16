import type { ClaudeMcpScope } from './claude-cli'

// ── Modes ─────────────────────────────────────────────────────────────────

export type AppMode = 'home' | 'inventory' | 'probe' | 'session' | 'playbook'

// ── Inventory (context sources) ───────────────────────────────────────────

export enum ContextType {
  GlobalClaudeMd = 'global-claude-md',
  ProjectClaudeMd = 'project-claude-md',
  FolderClaudeMd = 'folder-claude-md',
  Rule = 'rule',
  Skill = 'skill',
  Memory = 'memory',
  McpServer = 'mcp-server',
  Settings = 'settings',
}

export type ContextScope = 'project' | 'global'

export interface ContextSource {
  type: ContextType
  scope: ContextScope
  name: string
  filePath: string
  tokenEstimate: number
  /** For rules: the path globs that trigger loading */
  pathGlobs?: string[]
  /** For rules: true when the rule loads regardless of path */
  alwaysApply?: boolean
  /** For skills: description from frontmatter */
  description?: string
  /** For MCP servers: structured config so the detail view can render fields
   *  rather than dumping the underlying multi-purpose config blob (e.g.
   *  ~/.claude.json, which mixes MCP config with per-user runtime state). */
  mcp?: McpDetails
  /** For folder CLAUDE.md: which folder it scopes to */
  scopePath?: string
}

export interface McpDetails {
  /** stdio | sse | http — when known. */
  transport?: string
  /** Executable; absent for CLI-only entries where we don't read the config. */
  command?: string
  args?: string[]
  /** Env-var names only — values may be secrets and are never surfaced. */
  envKeys?: string[]
  /** The actual config file the server is defined in. Distinct from
   *  ContextSource.filePath only conceptually — we keep them in sync so the
   *  existing "Open file" affordances point at the right place. */
  sourceFile?: string
  /** Claude's three-way scope when known. ContextSource.scope collapses
   *  local→project; this preserves the original so the detail view can
   *  disambiguate (e.g. "Local: user-private, project-bound"). */
  claudeScope?: ClaudeMcpScope
}

export interface RuleFrontmatter {
  description?: string
  paths?: string[]
  alwaysApply?: boolean
}

export interface SkillFrontmatter {
  name?: string
  description?: string
  trigger?: string
}

export interface McpServerConfig {
  name: string
  command: string
  args?: string[]
  env?: Record<string, string>
  /** stdio | sse | http — Claude Code's `type` field, when set. */
  transport?: string
}

export interface HookConfig {
  event: string
  matcher: string
  /** Freeform description of what the hook does (the command/type). */
  action: string
}

export interface ProjectContext {
  projectPath: string
  projectName: string
  sources: ContextSource[]
  totalTokens: number
}

export interface Project {
  /** Absolute path to the project directory */
  path: string
  /** Display name (basename of path) */
  name: string
  /** Timestamp of last session in this project, if known */
  lastUsed: number | null
  /** Whether the project directory still exists on disk */
  exists: boolean
}

// ── Probe (static load-tree inference) ────────────────────────────────────

/**
 * Every probe node is either certain (loads on file-read) or conditional
 * (loads only when its trigger fires). The distinction is load-bearing —
 * see docs/decisions/0007.
 */
export type ProbeNodeState = 'certain' | 'conditional'

export type ProbeNodeKind =
  | 'system-prompt'
  | 'env-info'
  | 'global-claude-md'
  | 'project-claude-md'
  | 'folder-claude-md'
  | 'memory'
  | 'rule'
  | 'skill'
  | 'hook'
  | 'mcp-index'
  | 'mcp-schemas'
  | 'more' // "+N more" collapse node

export interface ProbeNode {
  id: string
  kind: ProbeNodeKind
  state: ProbeNodeState
  label: string
  /** Human description of why this node loads (shown on conditional branches). */
  trigger?: string
  /** Token estimate for this node's own content. */
  tokens: number
  /** Path on disk, if this node maps to a file. */
  filePath?: string
  /** Optional annotation (e.g. MEMORY.md overflow, glob that matched). */
  note?: string
  children?: ProbeNode[]
}

export interface ProbeResult {
  targetPath: string
  projectPath: string
  /** Sum of tokens across certain branches only. */
  certainTokens: number
  /** Sum across conditional branches (what *could* load if everything fired). */
  conditionalTokens: number
  tree: ProbeNode[]
}

export interface ProjectFileEntry {
  path: string
  name: string
  relPath: string
  isDirectory: boolean
}

// ── Static load (deterministic context injection) ────────────────────────
//
// Two granularities, both pure functions of disk state:
//  - project-static: what loads for ANY session in this project (global +
//    project CLAUDE.md, MEMORY.md window, always-apply rules, MCP index,
//    plus the synthetic system-prompt/env-info placeholders).
//  - file-static:    what additionally loads if a specific file is in scope
//    (folder-chain CLAUDE.mds along the path, path-scoped rules whose globs
//    match). These are how the session view derives why each loaded file's
//    "neighborhood" of CLAUDE.mds and rules is also in context.

export type StaticLoadEntryKind =
  | 'system-prompt'
  | 'env-info'
  | 'global-claude-md'
  | 'project-claude-md'
  | 'folder-claude-md'
  | 'memory'
  | 'rule'
  | 'mcp-index'

export interface StaticLoadEntry {
  kind: StaticLoadEntryKind
  /** 'global' = loads in every session everywhere; 'project' = every session
   *  in this project; 'file' = only when the triggering file is in scope. */
  scope: 'global' | 'project' | 'file'
  label: string
  tokens: number
  /** Absolute path on disk, when this entry maps to a real file. */
  filePath?: string
  /** For path-scoped rules: the globs from frontmatter that triggered the match. */
  pathGlobs?: string[]
  /** True for an always-apply rule. */
  alwaysApply?: boolean
  /** For file-static entries: the file whose presence pulled this in. */
  triggeredBy?: string
  /** Free-form annotation (e.g. MEMORY.md overflow stats). */
  note?: string
  /** Structured reason this entry is part of the load. Mirrored onto
   *  `LoadReason.via` so the session view can group loaded files by the
   *  rule/source that pulled each one in. */
  via?: LoadVia
}

export interface StaticLoadResult {
  projectPath: string
  /** Set when this is a per-file static load. */
  filePath?: string
  entries: StaticLoadEntry[]
  totalTokens: number
}

// ── Session (live loaded-context snapshot) ────────────────────────────────
// See docs/decisions/0010-session-as-live-loaded-context-snapshot.md

export interface SessionSummary {
  id: string
  filePath: string
  startedAt: number | null
  endedAt: number | null
  messageCount: number
  /** First user message, truncated — helps the user identify the session. */
  firstPrompt: string | null
}

/** How a file entered the session's loaded context. */
export type LoadMechanism =
  | 'read' // explicit Read tool
  | 'edit' // Edit tool (implies a prior read)
  | 'write' // Write tool
  | 'skill-invoke' // skill markdown loaded by Skill invocation
  | 'claude-md-auto' // CLAUDE.md auto-loaded by the folder chain
  | 'memory-auto' // MEMORY.md auto-loaded
  | 'rule-auto' // .claude/rules entry auto-loaded (always-apply or path-match)

/**
 * Why one item is in context. A loaded file accumulates one or more reasons:
 *  - JSONL evidence becomes `tool-call`
 *  - The project/global static bundle becomes `project-static`/`global-static`
 *  - Per-file static (folder CLAUDE.md, path-scoped rules) becomes `file-static`
 *    with `triggeredBy` pointing at the file whose presence pulled this in.
 *
 * See docs/decisions for the building-blocks split: project inventory,
 * project-static load, file-static load, active session.
 */
/**
 * What specifically caused a static load — the rule or built-in mechanism
 * Claude Code uses, not just "this file is loaded." Mirrored onto
 * `StaticLoadEntry.via` so the UI can group loaded files by the rule/source
 * that pulled them in instead of dumping a flat path list.
 */
export type LoadVia =
  | { kind: 'global-claude-md' }
  | { kind: 'project-claude-md' }
  | { kind: 'folder-claude-md'; chainDir: string }
  | { kind: 'memory' }
  | { kind: 'rule-always-apply'; rulePath: string }
  | { kind: 'rule-glob'; rulePath: string; matchedGlob: string }
  | { kind: 'mcp-index'; server: string; sourceFile: string }

export type LoadReason =
  | { kind: 'system' }
  | { kind: 'global-static'; via: LoadVia }
  | { kind: 'project-static'; via: LoadVia }
  | { kind: 'file-static'; triggeredBy: string; via: LoadVia }
  | { kind: 'tool-call'; tool: 'read' | 'edit' | 'write'; lineIndex: number }

export interface LoadedFile {
  /** Absolute path as it appeared in the tool call. */
  path: string
  name: string
  /** All mechanisms that touched this file, earliest first. */
  mechanisms: LoadMechanism[]
  readCount: number
  editCount: number
  writeCount: number
  firstLineIndex: number
  lastLineIndex: number
  /** Timestamp of the most recent load event, if parseable. */
  lastLoadedAt: number | null
  /** Approximate tokens for the content most recently loaded. */
  tokens: number
  /** Byte length of the content most recently loaded — used by the main
   *  process to detect changes against on-disk state. */
  lastLoadedSize: number
  /** True if the file changed on disk after this snapshot last loaded it.
   *  Set by the session-view stale annotator; absent on raw parser output. */
  staleSinceRead?: boolean
  /** Provenance: every reason this file ended up in context. Populated by
   *  the session-view builder (the raw JSONL parser only fills `mechanisms`). */
  reasons?: LoadReason[]
}

export interface LoadedMessagesSummary {
  count: number
  userCount: number
  assistantCount: number
}

export interface UsageInfo {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
}

export interface SkillInvocation {
  name: string
  /** Resolved markdown path if we could identify it. */
  filePath: string | null
  lineIndex: number
}

export interface McpSchemaFetch {
  /** Query passed to ToolSearch. */
  query: string
  lineIndex: number
}

export interface ClaudeMdEntry {
  path: string
  tokens: number
}

export interface LoadedContextSnapshot {
  sessionId: string
  projectPath: string
  files: LoadedFile[]
  messages: LoadedMessagesSummary
  /** Usage from the most recent assistant message that reported it.
   *  Represents the "currently loaded" context size for the next turn. */
  lastUsage: UsageInfo | null
  /** Model id from the most recent assistant message (e.g. `claude-opus-4-7`).
   *  Null if no assistant message reported one. */
  model: string | null
  /** System prompt size, if a system block was captured. */
  systemPrompt: { tokens: number } | null
  /** Environment-info block (cwd, platform, etc.), if captured. */
  envInfo: { tokens: number } | null
  /** Names of built-in Claude Code tools seen invoked. */
  systemTools: string[]
  memory: { path: string | null; tokens: number } | null
  claudeMdChain: ClaudeMdEntry[]
  skillsInvoked: SkillInvocation[]
  mcpSchemaFetches: McpSchemaFetch[]
  /** Epoch ms of the resolved session's most recent activity (transcript file
   *  mtime). Null when unknown. Lets a consumer judge whether the "active"
   *  session is actually current rather than a stale one from another
   *  worktree/checkout. Set by the session-view builder. */
  lastActivityAt: number | null
  /** True when the resolved active session has had no activity for longer
   *  than ACTIVE_SESSION_STALE_MS. Guards against treating a long-idle
   *  session as the live loaded context. Set by the session-view builder. */
  staleSession: boolean
}

/** Node in the merged session + on-disk file tree. */
export interface SessionTreeNode {
  name: string
  /** Absolute path. */
  path: string
  isDirectory: boolean
  /** Present only when this file was touched in the session. */
  loaded: LoadedFile | null
  /** True if the file changed on disk after the session last loaded it. */
  staleSinceRead: boolean
  children?: SessionTreeNode[]
  /** Rolled-up token total for directories (sum of descendants' loaded tokens). */
  loadedTokensRollup: number
  /** Rolled-up count of loaded descendants. */
  loadedCountRollup: number
}

/** Top-level tree: project root plus any external roots touched. */
export interface SessionTree {
  projectRoot: SessionTreeNode
  /** Files loaded from outside the project (e.g. ~/.claude/, /tmp). */
  externalRoots: SessionTreeNode[]
}

/** Full payload the renderer receives for the Session view. */
export interface SessionView {
  snapshot: LoadedContextSnapshot
  tree: SessionTree
  /** Set when this session ran inside a git-worktree checkout: the worktree
   *  directory name (e.g. "suspicious-knuth-46f895"). Null for sessions that
   *  ran in the main checkout. The tree is rooted at the worktree (that's the
   *  cwd Claude Code actually used) but labelled as the parent repo; this
   *  field lets the UI note which checkout it was. */
  worktree: string | null
}
