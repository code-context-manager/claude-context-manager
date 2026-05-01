import { useEffect, useMemo, useState } from 'react'
import type {
  PlaybookCategory,
  PlaybookEntry,
  PlaybookLoadResult,
} from '../../../../core/playbook'
import { useStore } from '../../store'
import { PageShell } from '../shell/PageShell'
import { buildImprovePlaybookPrompt } from '../../../../prompts/improve-playbook'

type Filter = 'all' | PlaybookCategory

const CATEGORY_LABEL: Record<PlaybookCategory, string> = {
  approach: 'Approach',
  tool: 'Tool',
}

export function PlaybookPage() {
  const [data, setData] = useState<PlaybookLoadResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const currentProject = useStore((s) => s.currentProject)
  const showToast = useStore((s) => s.showToast)
  const setDetailOpen = useStore((s) => s.setDetailOpen)

  const handleCopyImprovePrompt = async () => {
    await navigator.clipboard.writeText(buildImprovePlaybookPrompt(currentProject))
    showToast('Prompt copied. Paste it into a new Claude Code chat to start the discussion.')
  }

  useEffect(() => {
    let cancelled = false
    window.api.getPlaybookEntries().then((result) => {
      if (cancelled) return
      setData(result)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const visible = useMemo(() => {
    if (!data) return []
    if (filter === 'all') return data.entries
    return data.entries.filter((e) => e.category === filter)
  }, [data, filter])

  const selected = useMemo(
    () => (selectedId ? data?.entries.find((e) => e.id === selectedId) ?? null : null),
    [selectedId, data],
  )

  const handleSelect = (id: string) => {
    setSelectedId(id)
    setDetailOpen(true)
  }

  const toolbar = (
    <div className="flex items-center gap-1 text-xs">
      {(['all', 'approach', 'tool'] as Filter[]).map((f) => (
        <button
          key={f}
          onClick={() => setFilter(f)}
          className={`px-2.5 py-1 rounded-md transition-colors ${
            filter === f
              ? 'bg-surface-selected text-content-primary'
              : 'text-content-muted hover:bg-surface-hover hover:text-content-secondary'
          }`}
        >
          {f === 'all' ? 'All' : CATEGORY_LABEL[f] + 's'}
        </button>
      ))}
      {data && (
        <span className="ml-2 text-content-muted">
          {visible.length} {visible.length === 1 ? 'entry' : 'entries'}
        </span>
      )}
    </div>
  )

  return (
    <PageShell
      title="Playbook"
      description={
        <>
          Things you can adopt to make Claude work better with your repo. Curated from the
          community-edited <span className="font-mono">claude-context-playbook</span> repo.
        </>
      }
      actions={
        <button
          onClick={handleCopyImprovePrompt}
          title="Copy a prompt that asks Claude to recommend playbook entries that would most help this project"
          className="shrink-0 px-3 py-1.5 rounded-md text-xs font-medium border border-edge bg-surface-sidebar hover:bg-surface-hover hover:border-content-muted text-content-secondary hover:text-content-primary transition-colors"
        >
          Apply to project…
        </button>
      }
      toolbar={toolbar}
      main={
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="px-6 py-8 text-sm text-content-muted">Loading Playbook…</div>
            )}
            {!loading && data && data.source === 'none' && <PlaybookMissing />}
            {!loading && data && data.source !== 'none' && visible.length === 0 && (
              <div className="px-6 py-8 text-sm text-content-muted">No entries match.</div>
            )}
            {!loading && data && data.source !== 'none' && visible.length > 0 && (
              <ul className="divide-y divide-edge">
                {visible.map((entry) => (
                  <li key={entry.id}>
                    <button
                      onClick={() => handleSelect(entry.id)}
                      className={`w-full text-left px-6 py-4 transition-colors ${
                        selectedId === entry.id
                          ? 'bg-surface-selected'
                          : 'hover:bg-surface-hover'
                      }`}
                    >
                      <div className="flex items-baseline gap-2">
                        <h2 className="text-sm font-medium text-content-primary">
                          {entry.title}
                        </h2>
                        <CategoryBadge category={entry.category} />
                        {entry.maturity && <MaturityBadge maturity={entry.maturity} />}
                      </div>
                      <p className="mt-1 text-xs text-content-muted leading-relaxed">
                        {entry.tagline}
                      </p>
                      {entry.tags && entry.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {entry.tags.map((t) => (
                            <span
                              key={t}
                              className="text-[10px] uppercase tracking-wide text-content-muted px-1.5 py-0.5 rounded bg-surface-sidebar"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!loading && data && data.errors.length > 0 && (
              <div className="px-6 py-3 border-t border-edge text-xs text-content-muted">
                {data.errors.length} entr{data.errors.length === 1 ? 'y' : 'ies'} skipped due to
                parse errors.
              </div>
            )}
          </div>
          {!loading && data && data.rootPath && (
            <div className="px-6 py-2 border-t border-edge text-[11px] text-content-muted">
              Source: <span className="font-mono">{data.rootPath}</span>
            </div>
          )}
        </div>
      }
      detail={
        <aside className="h-full flex flex-col">
          <div className="flex-1 overflow-y-auto">
            {selected ? (
              <PlaybookDetail entry={selected} />
            ) : (
              <div className="px-6 py-8 text-xs text-content-muted">Select an entry.</div>
            )}
          </div>
        </aside>
      }
    />
  )
}

function CategoryBadge({ category }: { category: PlaybookCategory }) {
  return (
    <span className="text-[10px] uppercase tracking-wide text-content-muted">
      {CATEGORY_LABEL[category]}
    </span>
  )
}

function MaturityBadge({ maturity }: { maturity: NonNullable<PlaybookEntry['maturity']> }) {
  return (
    <span className="text-[10px] uppercase tracking-wide text-content-muted">· {maturity}</span>
  )
}

function PlaybookDetail({ entry }: { entry: PlaybookEntry }) {
  return (
    <div className="px-6 py-5">
      <div className="flex items-baseline gap-2">
        <h2 className="text-base font-medium text-content-primary">{entry.title}</h2>
        <CategoryBadge category={entry.category} />
      </div>
      <p className="mt-1 text-sm text-content-secondary leading-relaxed">{entry.tagline}</p>

      <div className="mt-5 text-sm text-content-secondary leading-relaxed whitespace-pre-wrap">
        {entry.description}
      </div>

      {entry.links.length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs font-medium text-content-muted uppercase tracking-wide">Links</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {entry.links.map((l) => (
              <li key={l.url}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-content-primary hover:underline"
                >
                  {l.label}
                </a>{' '}
                <span className="text-content-muted text-xs">{l.url}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {entry.detect && entry.detect.length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs font-medium text-content-muted uppercase tracking-wide">
            Detect
          </h3>
          <ul className="mt-2 space-y-1 text-xs font-mono text-content-secondary">
            {entry.detect.map((d, i) => (
              <li key={i}>{describeDetect(d)}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-edge text-[11px] text-content-muted space-y-0.5">
        <div>
          id: <span className="font-mono">{entry.id}</span>
        </div>
        {entry.submitted_at && <div>submitted: {entry.submitted_at}</div>}
        {entry.submitted_by && <div>by: {entry.submitted_by}</div>}
      </div>
    </div>
  )
}

function describeDetect(d: NonNullable<PlaybookEntry['detect']>[number]): string {
  switch (d.kind) {
    case 'file_exists':
      return `file_exists ${d.path}`
    case 'file_contains':
      return `file_contains ${d.path} ⊃ "${d.contains}"`
    case 'package_installed':
      return `package_installed ${d.name}${d.ecosystem ? ` (${d.ecosystem})` : ''}`
    case 'mcp_server_configured':
      return `mcp_server_configured ${d.name}`
  }
}

function PlaybookMissing() {
  return (
    <div className="px-6 py-8 text-sm text-content-secondary max-w-xl">
      <p>
        Couldn't find a local checkout of the Playbook repo. The desktop app expects a sibling
        directory named{' '}
        <span className="font-mono text-content-primary">claude-context-playbook</span> next to
        this repo.
      </p>
      <p className="mt-3 text-xs text-content-muted">
        Override with the <span className="font-mono">CCM_PLAYBOOK_PATH</span> environment
        variable. Cached and remote sources are not yet wired (see docs/playbook.md).
      </p>
    </div>
  )
}
