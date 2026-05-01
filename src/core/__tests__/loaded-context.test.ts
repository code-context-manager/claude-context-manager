import { describe, it, expect } from 'vitest'
import { computeLoadedContext } from '../loaded-context'

function jsonl(...lines: unknown[]): string {
  return lines.map((l) => JSON.stringify(l)).join('\n')
}

describe('computeLoadedContext', () => {
  it('returns empty snapshot for empty input', () => {
    const snap = computeLoadedContext('', 'sess', '/proj')
    expect(snap.files).toEqual([])
    expect(snap.messages.count).toBe(0)
    expect(snap.lastUsage).toBeNull()
    expect(snap.skillsInvoked).toEqual([])
  })

  it('counts user and assistant messages', () => {
    const raw = jsonl(
      { type: 'user', message: { content: 'hello' } },
      { type: 'assistant', message: { content: [{ type: 'text', text: 'hi' }], usage: { input_tokens: 100, output_tokens: 10 } } },
    )
    const snap = computeLoadedContext(raw, 's', '/p')
    expect(snap.messages.userCount).toBe(1)
    expect(snap.messages.assistantCount).toBe(1)
    expect(snap.lastUsage?.inputTokens).toBe(100)
    expect(snap.lastUsage?.outputTokens).toBe(10)
  })

  it('tracks Read tool uses as loaded files', () => {
    const raw = jsonl(
      {
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: '/proj/a.ts' } },
          ],
        },
      },
      {
        type: 'user',
        message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: 'abcdefgh' }] },
      },
    )
    const snap = computeLoadedContext(raw, 's', '/proj')
    expect(snap.files).toHaveLength(1)
    expect(snap.files[0].path).toBe('/proj/a.ts')
    expect(snap.files[0].mechanisms).toContain('read')
    expect(snap.files[0].readCount).toBe(1)
    expect(snap.files[0].lastLoadedSize).toBe(8)
    expect(snap.files[0].tokens).toBeGreaterThan(0)
  })

  it('merges repeat reads into a single file entry', () => {
    const raw = jsonl(
      {
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: '/p/x.ts' } },
          ],
        },
      },
      { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: 'foo' }] } },
      {
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', id: 't2', name: 'Read', input: { file_path: '/p/x.ts' } },
          ],
        },
      },
      { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't2', content: 'foobar' }] } },
    )
    const snap = computeLoadedContext(raw, 's', '/p')
    expect(snap.files).toHaveLength(1)
    expect(snap.files[0].readCount).toBe(2)
    expect(snap.files[0].lastLoadedSize).toBe(6)
  })

  it('tracks Edit and Write with distinct mechanisms', () => {
    const raw = jsonl(
      {
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', id: 't1', name: 'Edit', input: { file_path: '/p/e.ts' } },
            { type: 'tool_use', id: 't2', name: 'Write', input: { file_path: '/p/w.ts' } },
          ],
        },
      },
    )
    const snap = computeLoadedContext(raw, 's', '/p')
    const edit = snap.files.find((f) => f.path === '/p/e.ts')
    const write = snap.files.find((f) => f.path === '/p/w.ts')
    expect(edit?.mechanisms).toContain('edit')
    expect(edit?.editCount).toBe(1)
    expect(write?.mechanisms).toContain('write')
    expect(write?.writeCount).toBe(1)
  })

  it('records skill invocations', () => {
    const raw = jsonl(
      {
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', id: 's1', name: 'Skill', input: { skill: 'plan-feature' } },
          ],
        },
      },
    )
    const snap = computeLoadedContext(raw, 's', '/p')
    expect(snap.skillsInvoked).toHaveLength(1)
    expect(snap.skillsInvoked[0].name).toBe('plan-feature')
  })

  it('records MCP schema fetches from ToolSearch', () => {
    const raw = jsonl(
      {
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', id: 'ts1', name: 'ToolSearch', input: { query: 'select:TodoWrite' } },
          ],
        },
      },
    )
    const snap = computeLoadedContext(raw, 's', '/p')
    expect(snap.mcpSchemaFetches).toHaveLength(1)
    expect(snap.mcpSchemaFetches[0].query).toBe('select:TodoWrite')
  })

  it('surfaces CLAUDE.md and MEMORY.md reads in their dedicated buckets', () => {
    const raw = jsonl(
      {
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: '/p/CLAUDE.md' } },
            { type: 'tool_use', id: 't2', name: 'Read', input: { file_path: '/home/u/.claude/memory/MEMORY.md' } },
          ],
        },
      },
      { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: 'xx' }] } },
      { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't2', content: 'yy' }] } },
    )
    const snap = computeLoadedContext(raw, 's', '/p')
    expect(snap.claudeMdChain.map((c) => c.path)).toContain('/p/CLAUDE.md')
    expect(snap.memory?.path).toBe('/home/u/.claude/memory/MEMORY.md')
  })

  it('captures model id from the most recent assistant turn', () => {
    const raw = jsonl(
      {
        type: 'assistant',
        message: {
          model: 'claude-haiku-4-5',
          content: [],
          usage: { input_tokens: 1_000_000, output_tokens: 0 },
        },
      },
      {
        type: 'assistant',
        message: {
          model: 'claude-haiku-4-5',
          content: [],
          usage: { input_tokens: 0, output_tokens: 1_000_000 },
        },
      },
    )
    const snap = computeLoadedContext(raw, 's', '/p')
    expect(snap.model).toBe('claude-haiku-4-5')
  })

  it('keeps only the last usage field', () => {
    const raw = jsonl(
      { type: 'assistant', message: { content: [], usage: { input_tokens: 50 } } },
      { type: 'assistant', message: { content: [], usage: { input_tokens: 150, output_tokens: 20 } } },
    )
    const snap = computeLoadedContext(raw, 's', '/p')
    expect(snap.lastUsage?.inputTokens).toBe(150)
    expect(snap.lastUsage?.outputTokens).toBe(20)
  })

  it('tolerates malformed lines', () => {
    const raw = '{not json\n' + jsonl({ type: 'user', message: { content: 'ok' } })
    expect(() => computeLoadedContext(raw, 's', '/p')).not.toThrow()
    const snap = computeLoadedContext(raw, 's', '/p')
    expect(snap.messages.userCount).toBe(1)
  })
})
