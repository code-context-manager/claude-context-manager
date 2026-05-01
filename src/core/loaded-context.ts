import type {
  ClaudeMdEntry,
  LoadedContextSnapshot,
  LoadedFile,
  LoadMechanism,
  McpSchemaFetch,
  SkillInvocation,
  UsageInfo,
} from './types'
import { estimateTokens } from './token-estimator'

/**
 * Reduce a Claude Code session JSONL into a snapshot of what is currently
 * loaded in its context. See docs/decisions/0010.
 *
 * Environment-neutral: pure string → struct. Filesystem-aware enrichment
 * (stale-since-read, on-disk tree merge) happens in the main process.
 */

interface JsonlLine {
  type?: string
  timestamp?: string
  message?: {
    role?: string
    model?: string
    content?: unknown
    usage?: {
      input_tokens?: number
      output_tokens?: number
      cache_read_input_tokens?: number
      cache_creation_input_tokens?: number
    }
  }
  toolUseResult?: unknown
  content?: unknown
  [k: string]: unknown
}

interface ToolUseBlock {
  type: 'tool_use'
  id?: string
  name?: string
  input?: Record<string, unknown>
}

interface ToolResultBlock {
  type: 'tool_result'
  tool_use_id?: string
  content?: unknown
}

interface TextBlock {
  type: 'text'
  text?: string
}

type ContentBlock = ToolUseBlock | ToolResultBlock | TextBlock | { type: string; [k: string]: unknown }

/**
 * Built-in Claude Code tool names that read/edit files on disk and therefore
 * count as "loading a file into context".
 */
const FILE_TOOLS = new Set(['read', 'edit', 'write', 'notebookedit'])

export function computeLoadedContext(
  raw: string,
  sessionId: string,
  projectPath: string,
): LoadedContextSnapshot {
  const files = new Map<string, LoadedFile>()
  const skillsInvoked: SkillInvocation[] = []
  const mcpSchemaFetches: McpSchemaFetch[] = []
  const systemToolsSet = new Set<string>()
  const claudeMdChain: ClaudeMdEntry[] = []
  const seenClaudeMd = new Set<string>()

  let userCount = 0
  let assistantCount = 0
  let messageCount = 0
  let lastUsage: UsageInfo | null = null
  let model: string | null = null
  let systemPromptTokens = 0
  let envInfoTokens = 0
  let memory: { path: string | null; tokens: number } | null = null

  // Pending tool_use metadata so we can enrich when the matching
  // tool_result arrives on a following line.
  const pendingTools = new Map<
    string,
    { name: string; input: Record<string, unknown>; lineIndex: number; timestamp: number | null }
  >()

  const lines = raw.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    let obj: JsonlLine
    try {
      obj = JSON.parse(line) as JsonlLine
    } catch {
      continue
    }

    const ts = obj.timestamp ? Date.parse(obj.timestamp) : NaN
    const timestamp = Number.isFinite(ts) ? ts : null

    if (obj.type === 'system') {
      const text = flattenText(obj.message?.content ?? obj.content)
      if (text) {
        const tokens = estimateTokens(text)
        // Heuristic: the first system block is the system prompt; anything
        // that looks like env info (cwd, platform) is tagged separately.
        if (/cwd|platform|working directory|OS Version/i.test(text) && envInfoTokens === 0) {
          envInfoTokens = tokens
        } else if (systemPromptTokens === 0) {
          systemPromptTokens = tokens
        }
      }
      continue
    }

    if (obj.type === 'user') {
      const content = obj.message?.content
      if (isToolResultOnly(content)) {
        // Match tool_results to pending tool_uses to capture file content.
        if (Array.isArray(content)) {
          for (const block of content as ContentBlock[]) {
            if (block.type !== 'tool_result') continue
            const tr = block as ToolResultBlock
            if (!tr.tool_use_id) continue
            const pending = pendingTools.get(tr.tool_use_id)
            if (!pending) continue
            const resultText = flattenText(tr.content) ?? ''
            handleToolResult(pending, resultText, i)
            pendingTools.delete(tr.tool_use_id)
          }
        }
        continue
      }
      const text = flattenText(content)
      if (text || isUserPrompt(content)) {
        userCount++
        messageCount++
      }
      continue
    }

    if (obj.type === 'assistant') {
      assistantCount++
      messageCount++

      const turnModel = obj.message?.model
      if (typeof turnModel === 'string' && turnModel.length > 0) {
        model = turnModel
      }

      const usage = obj.message?.usage
      if (usage && typeof usage.input_tokens === 'number') {
        const turnUsage: UsageInfo = {
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens ?? 0,
          cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
          cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
        }
        lastUsage = turnUsage
      }

      const content = obj.message?.content
      if (!Array.isArray(content)) continue

      for (const block of content as ContentBlock[]) {
        if (block.type !== 'tool_use') continue
        const tu = block as ToolUseBlock
        const name = String(tu.name ?? '')
        if (!name) continue
        systemToolsSet.add(name)

        const input = tu.input ?? {}
        const lowerName = name.toLowerCase()

        if (FILE_TOOLS.has(lowerName)) {
          const path = extractPath(input)
          if (path) {
            const mechanism: LoadMechanism =
              lowerName === 'edit' ? 'edit' : lowerName === 'write' ? 'write' : 'read'
            touchFile(files, path, mechanism, i, timestamp)
          }
        } else if (lowerName === 'skill') {
          const skillName = String(input.skill ?? input.name ?? '')
          if (skillName) {
            skillsInvoked.push({ name: skillName, filePath: null, lineIndex: i })
          }
        } else if (lowerName === 'toolsearch') {
          const query = String(input.query ?? '')
          mcpSchemaFetches.push({ query, lineIndex: i })
        }

        if (tu.id) {
          pendingTools.set(tu.id, { name, input, lineIndex: i, timestamp })
        }
      }
      continue
    }
  }

  // If we saw MEMORY.md loaded as a file, surface it.
  for (const file of files.values()) {
    if (/MEMORY\.md$/.test(file.path) && !memory) {
      memory = { path: file.path, tokens: file.tokens }
    }
    if (/CLAUDE\.md$/.test(file.path) && !seenClaudeMd.has(file.path)) {
      seenClaudeMd.add(file.path)
      claudeMdChain.push({ path: file.path, tokens: file.tokens })
    }
  }

  return {
    sessionId,
    projectPath,
    files: Array.from(files.values()).sort((a, b) => a.path.localeCompare(b.path)),
    messages: { count: messageCount, userCount, assistantCount },
    lastUsage,
    model,
    systemPrompt: systemPromptTokens > 0 ? { tokens: systemPromptTokens } : null,
    envInfo: envInfoTokens > 0 ? { tokens: envInfoTokens } : null,
    systemTools: Array.from(systemToolsSet).sort(),
    memory,
    claudeMdChain,
    skillsInvoked,
    mcpSchemaFetches,
  }

  function handleToolResult(
    pending: { name: string; input: Record<string, unknown>; lineIndex: number; timestamp: number | null },
    resultText: string,
    resultLineIndex: number,
  ): void {
    const lowerName = pending.name.toLowerCase()
    if (FILE_TOOLS.has(lowerName)) {
      const path = extractPath(pending.input)
      if (path) {
        const entry = files.get(path)
        if (entry) {
          entry.lastLoadedSize = resultText.length
          entry.tokens = estimateTokens(resultText)
          entry.lastLineIndex = Math.max(entry.lastLineIndex, resultLineIndex)
        }
      }
    } else if (lowerName === 'skill') {
      const skill = skillsInvoked[skillsInvoked.length - 1]
      if (skill && skill.name === String(pending.input.skill ?? pending.input.name ?? '')) {
        // Skill results don't carry a file path, but the body content counts
        // toward tokens. We record it as a synthetic "file" keyed by the
        // skill name so it shows up in the non-fs panel. Path discovery
        // happens in the main process.
        skill.filePath = null
      }
    }
  }
}

function touchFile(
  files: Map<string, LoadedFile>,
  path: string,
  mechanism: LoadMechanism,
  lineIndex: number,
  timestamp: number | null,
): void {
  const existing = files.get(path)
  if (existing) {
    if (!existing.mechanisms.includes(mechanism)) existing.mechanisms.push(mechanism)
    if (mechanism === 'read') existing.readCount++
    else if (mechanism === 'edit') existing.editCount++
    else if (mechanism === 'write') existing.writeCount++
    existing.lastLineIndex = lineIndex
    if (timestamp !== null) existing.lastLoadedAt = timestamp
    return
  }
  files.set(path, {
    path,
    name: basename(path),
    mechanisms: [mechanism],
    readCount: mechanism === 'read' ? 1 : 0,
    editCount: mechanism === 'edit' ? 1 : 0,
    writeCount: mechanism === 'write' ? 1 : 0,
    firstLineIndex: lineIndex,
    lastLineIndex: lineIndex,
    lastLoadedAt: timestamp,
    tokens: 0,
    lastLoadedSize: 0,
  })
}

function extractPath(input: Record<string, unknown>): string | null {
  const candidate = input.file_path ?? input.path ?? input.notebook_path
  if (typeof candidate === 'string' && candidate.length > 0) return candidate
  return null
}

function flattenText(content: unknown): string | null {
  if (!content) return null
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return null
  const parts: string[] = []
  for (const block of content) {
    if (typeof block === 'string') {
      parts.push(block)
    } else if (block && typeof block === 'object') {
      const b = block as { text?: unknown; content?: unknown }
      if (typeof b.text === 'string') parts.push(b.text)
      else if (typeof b.content === 'string') parts.push(b.content)
    }
  }
  const joined = parts.join(' ').trim()
  return joined.length > 0 ? joined : null
}

function isToolResultOnly(content: unknown): boolean {
  if (!Array.isArray(content)) return false
  return content.every(
    (b) => typeof b === 'object' && b && (b as { type?: string }).type === 'tool_result',
  )
}

function isUserPrompt(content: unknown): boolean {
  if (typeof content === 'string') return content.trim().length > 0
  if (!Array.isArray(content)) return false
  return content.some(
    (b) => typeof b === 'object' && b && (b as { type?: string }).type === 'text',
  )
}

function basename(p: string): string {
  const idx = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  return idx >= 0 ? p.slice(idx + 1) : p
}
