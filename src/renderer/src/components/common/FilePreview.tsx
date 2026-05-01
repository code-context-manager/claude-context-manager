import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Props {
  filePath: string | null | undefined
  content: string | null
  loading: boolean
  maxChars?: number
}

const DEFAULT_MAX = 4000

export function FilePreview({ filePath, content, loading, maxChars = DEFAULT_MAX }: Props) {
  if (loading) return <p className="text-xs text-content-muted">Loading…</p>
  if (!content) return <p className="text-xs text-content-muted">Could not read file.</p>

  const isMarkdown = !!filePath && filePath.toLowerCase().endsWith('.md')

  if (isMarkdown) {
    const { frontmatter, body } = splitFrontmatter(content)
    const truncated = body.length > maxChars
    const shown = truncated ? body.slice(0, maxChars) : body
    return (
      <div className="flex flex-col gap-3">
        {frontmatter.length > 0 && <Frontmatter entries={frontmatter} />}
        <div className="prose prose-sm prose-app max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{shown}</ReactMarkdown>
        </div>
        {truncated && <p className="text-xs text-content-muted">…truncated…</p>}
      </div>
    )
  }

  const truncated = content.length > maxChars
  const body = truncated ? content.slice(0, maxChars) : content
  return (
    <pre className="text-xs text-content-secondary whitespace-pre-wrap font-mono leading-relaxed">
      {body}
      {truncated && '\n\n…truncated…'}
    </pre>
  )
}

function Frontmatter({ entries }: { entries: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs bg-surface-raised rounded px-3 py-2 border border-edge">
      {entries.map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="text-content-muted font-mono uppercase tracking-wider text-[10px] self-start pt-0.5">
            {key}
          </dt>
          <dd className="text-content-secondary whitespace-pre-wrap break-words">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

function splitFrontmatter(text: string): { frontmatter: [string, string][]; body: string } {
  const match = text.match(FRONTMATTER_RE)
  if (!match) return { frontmatter: [], body: text }
  return {
    frontmatter: parseSimpleYaml(match[1]),
    body: text.slice(match[0].length),
  }
}

// Skill / CLAUDE.md frontmatter is plain `key: value` pairs (sometimes with
// folded long values continued on indented lines). We don't need a real YAML
// parser for that — and pulling one in would be heavier than the data warrants.
function parseSimpleYaml(text: string): [string, string][] {
  const out: [string, string][] = []
  let current: [string, string] | null = null
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, '')
    if (!line) continue
    const isContinuation = /^\s/.test(rawLine) && current
    if (isContinuation) {
      current[1] += ' ' + line.trim()
      continue
    }
    const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/)
    if (!m) continue
    current = [m[1], unquote(m[2])]
    out.push(current)
  }
  return out
}

function unquote(s: string): string {
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1)
  }
  return s
}
