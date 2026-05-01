import { describe, it, expect } from 'vitest'
import {
  parsePlaybookYaml,
  parsePlaybookEntry,
  loadPlaybookFromLocal,
} from '../playbook'
import type { FsReader, FsStat, DirEntry } from '../fs'

const SAMPLE = `id: agents-md
category: approach
title: AGENTS.md
tagline: Cross-tool convention for agent instructions, sitting alongside README.md.
description: |
  AGENTS.md is an emerging convention for a single file at the root of a repo
  that holds instructions intended for AI coding agents.

  Adopt it when you want one set of agent instructions.
links:
  - { label: Spec, url: "https://agents.md" }
detect:
  - { kind: file_exists, path: AGENTS.md }
tags: [convention, instructions, portability]
maturity: emerging
submitted_at: "2026-04-26"
`

describe('parsePlaybookYaml', () => {
  it('parses scalars, block literal, flow array, and block sequence of flow maps', () => {
    const out = parsePlaybookYaml(SAMPLE)
    expect(out.id).toBe('agents-md')
    expect(out.category).toBe('approach')
    expect(typeof out.description).toBe('string')
    expect(out.description).toContain('AGENTS.md is an emerging convention')
    // blank line in literal block preserved
    expect(out.description).toContain('\n\nAdopt it')
    expect(out.tags).toEqual(['convention', 'instructions', 'portability'])
    expect(Array.isArray(out.links)).toBe(true)
    expect((out.links as Record<string, string>[])[0]).toEqual({
      label: 'Spec',
      url: 'https://agents.md',
    })
    expect((out.detect as Record<string, string>[])[0]).toEqual({
      kind: 'file_exists',
      path: 'AGENTS.md',
    })
    expect(out.submitted_at).toBe('2026-04-26')
  })

  it('handles empty input', () => {
    expect(parsePlaybookYaml('')).toEqual({})
  })

  it('preserves commas inside quoted flow-map values', () => {
    const out = parsePlaybookYaml(`links:\n  - { label: "A, B", url: "https://x" }\n`)
    expect((out.links as Record<string, string>[])[0]).toEqual({
      label: 'A, B',
      url: 'https://x',
    })
  })
})

describe('parsePlaybookEntry', () => {
  it('parses a valid entry', () => {
    const result = parsePlaybookEntry(SAMPLE, 'agents-md.yml')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.entry.id).toBe('agents-md')
    expect(result.entry.category).toBe('approach')
    expect(result.entry.links[0].url).toBe('https://agents.md')
    expect(result.entry.detect).toEqual([{ kind: 'file_exists', path: 'AGENTS.md' }])
    expect(result.entry.tags).toEqual(['convention', 'instructions', 'portability'])
    expect(result.entry.maturity).toBe('emerging')
    expect(result.entry.sourcePath).toBe('agents-md.yml')
  })

  it('rejects entry with missing required fields', () => {
    const yaml = `id: foo\ncategory: approach\ntitle: Foo\n`
    const result = parsePlaybookEntry(yaml, 'foo.yml')
    expect(result.ok).toBe(false)
  })

  it('rejects an invalid category', () => {
    const yaml = `id: foo
category: nonsense
title: Foo
tagline: bar
description: baz
links:
  - { label: x, url: "https://x" }
`
    const result = parsePlaybookEntry(yaml, 'foo.yml')
    expect(result.ok).toBe(false)
  })

  it('handles malformed yaml gracefully', () => {
    const result = parsePlaybookEntry('::: not yaml :::', 'bad.yml')
    expect(result.ok).toBe(false)
  })

  it('treats empty input as missing fields', () => {
    const result = parsePlaybookEntry('', 'empty.yml')
    expect(result.ok).toBe(false)
  })
})

// ── In-memory FsReader for loadPlaybookFromLocal ─────────────────────

interface MemFs {
  files: Record<string, string>
  dirs: Record<string, string[]>
}

function makeFs(mem: MemFs): FsReader {
  return {
    async readFile(p) {
      return p in mem.files ? mem.files[p] : null
    },
    async readdir(p) {
      return p in mem.dirs ? mem.dirs[p] : null
    },
    async readdirWithTypes(p): Promise<DirEntry[] | null> {
      const names = mem.dirs[p]
      if (!names) return null
      return names.map((n) => ({
        name: n,
        isDirectory: `${p}/${n}` in mem.dirs,
      }))
    },
    async stat(p): Promise<FsStat | null> {
      if (p in mem.dirs) {
        return { isFile: false, isDirectory: true, mtimeMs: 0, birthtimeMs: 0 }
      }
      if (p in mem.files) {
        return { isFile: true, isDirectory: false, mtimeMs: 0, birthtimeMs: 0 }
      }
      return null
    },
  }
}

describe('loadPlaybookFromLocal', () => {
  it('returns empty + source none when root missing', async () => {
    const fs = makeFs({ files: {}, dirs: {} })
    const result = await loadPlaybookFromLocal(fs, '/nope')
    expect(result.source).toBe('none')
    expect(result.entries).toEqual([])
    expect(result.rootPath).toBeNull()
  })

  it('reads and parses entries from approaches/ and tools/', async () => {
    const fs = makeFs({
      files: {
        '/pb/entries/approaches/agents-md.yml': SAMPLE,
        '/pb/entries/tools/ccm.yml': `id: ccm
category: tool
title: Claude Context Manager
tagline: Desktop app.
description: |
  Body.
links:
  - { label: Repo, url: "https://example.com" }
`,
        '/pb/entries/approaches/README.md': 'ignored',
      },
      dirs: {
        '/pb': ['entries'],
        '/pb/entries': ['approaches', 'tools'],
        '/pb/entries/approaches': ['agents-md.yml', 'README.md'],
        '/pb/entries/tools': ['ccm.yml'],
      },
    })
    const result = await loadPlaybookFromLocal(fs, '/pb')
    expect(result.source).toBe('local')
    expect(result.rootPath).toBe('/pb')
    expect(result.entries.map((e) => e.id).sort()).toEqual(['agents-md', 'ccm'])
    // entries are sorted by title
    expect(result.entries[0].title).toBe('AGENTS.md')
    expect(result.entries[1].title).toBe('Claude Context Manager')
    expect(result.errors).toEqual([])
  })

  it('collects per-file errors instead of throwing', async () => {
    const fs = makeFs({
      files: {
        '/pb/entries/approaches/good.yml': SAMPLE,
        '/pb/entries/approaches/bad.yml': `id: bad\ncategory: approach\n`,
      },
      dirs: {
        '/pb': ['entries'],
        '/pb/entries': ['approaches'],
        '/pb/entries/approaches': ['good.yml', 'bad.yml'],
        '/pb/entries/tools': [],
      },
    })
    const result = await loadPlaybookFromLocal(fs, '/pb')
    expect(result.entries).toHaveLength(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].sourcePath).toBe('/pb/entries/approaches/bad.yml')
  })
})
