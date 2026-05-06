import { describe, it, expect } from 'vitest'
import {
  computeRegistrationUpdate,
  computeRegistrationRemoval,
  SELF_REGISTRATION_NAME,
  type SelfRegistrationConfig,
} from '../mcp-self-register'

const expected: SelfRegistrationConfig = {
  type: 'stdio',
  command: 'node',
  args: ['/abs/path/to/out/mcp/index.mjs'],
}

function parse(content: string | null): Record<string, unknown> {
  if (content === null) throw new Error('expected non-null content')
  return JSON.parse(content)
}

describe('computeRegistrationUpdate', () => {
  it('creates a fresh file when none exists', () => {
    const r = computeRegistrationUpdate(null, expected)
    expect(r.changed).toBe(true)
    expect(r.reason).toBe('fresh-file')
    expect(parse(r.nextContent!)).toEqual({
      mcpServers: { [SELF_REGISTRATION_NAME]: expected },
    })
  })

  it('adds the entry when mcpServers is missing', () => {
    const current = JSON.stringify({ otherKey: 1 })
    const r = computeRegistrationUpdate(current, expected)
    expect(r.changed).toBe(true)
    expect(r.reason).toBe('absent')
    const next = parse(r.nextContent!)
    expect(next.otherKey).toBe(1)
    expect((next.mcpServers as Record<string, unknown>)[SELF_REGISTRATION_NAME]).toEqual(expected)
  })

  it('preserves sibling mcpServers entries', () => {
    const current = JSON.stringify({
      mcpServers: {
        'other-server': { type: 'stdio', command: 'foo', args: ['bar'] },
      },
    })
    const r = computeRegistrationUpdate(current, expected)
    expect(r.changed).toBe(true)
    expect(r.reason).toBe('absent')
    const servers = parse(r.nextContent!).mcpServers as Record<string, unknown>
    expect(servers['other-server']).toEqual({ type: 'stdio', command: 'foo', args: ['bar'] })
    expect(servers[SELF_REGISTRATION_NAME]).toEqual(expected)
  })

  it('is idempotent when the entry already matches', () => {
    const current = JSON.stringify({
      mcpServers: { [SELF_REGISTRATION_NAME]: expected },
    })
    const r = computeRegistrationUpdate(current, expected)
    expect(r.changed).toBe(false)
    expect(r.reason).toBe('idempotent')
    expect(r.nextContent).toBeNull()
  })

  it('rewrites a stale entry (path drifted)', () => {
    const stale = { type: 'stdio', command: 'node', args: ['/old/path/index.mjs'] }
    const current = JSON.stringify({
      mcpServers: { [SELF_REGISTRATION_NAME]: stale },
    })
    const r = computeRegistrationUpdate(current, expected)
    expect(r.changed).toBe(true)
    expect(r.reason).toBe('stale')
    const servers = parse(r.nextContent!).mcpServers as Record<string, unknown>
    expect(servers[SELF_REGISTRATION_NAME]).toEqual(expected)
  })

  it('refuses to overwrite an unparseable file', () => {
    const r = computeRegistrationUpdate('not valid json {{{', expected)
    expect(r.changed).toBe(false)
    expect(r.nextContent).toBeNull()
  })

  it('refuses to overwrite a JSON file whose root is not an object', () => {
    const r = computeRegistrationUpdate(JSON.stringify(['array', 'root']), expected)
    expect(r.changed).toBe(false)
  })

  it('detects argument-list differences as stale', () => {
    const stale = { type: 'stdio', command: 'node', args: ['/abs/path/to/out/mcp/index.mjs', '--extra'] }
    const current = JSON.stringify({
      mcpServers: { [SELF_REGISTRATION_NAME]: stale },
    })
    const r = computeRegistrationUpdate(current, expected)
    expect(r.changed).toBe(true)
    expect(r.reason).toBe('stale')
  })
})

describe('computeRegistrationRemoval', () => {
  it('does nothing when the file is missing', () => {
    const r = computeRegistrationRemoval(null)
    expect(r.changed).toBe(false)
    expect(r.reason).toBe('no-file')
    expect(r.nextContent).toBeNull()
  })

  it('does nothing when the entry is absent', () => {
    const current = JSON.stringify({ mcpServers: { other: {} } })
    const r = computeRegistrationRemoval(current)
    expect(r.changed).toBe(false)
    expect(r.reason).toBe('absent')
  })

  it('does nothing when the file is unparseable', () => {
    const r = computeRegistrationRemoval('garbage }}}')
    expect(r.changed).toBe(false)
    expect(r.reason).toBe('unparseable')
  })

  it('removes the entry and preserves siblings', () => {
    const current = JSON.stringify({
      otherKey: 'preserved',
      mcpServers: {
        [SELF_REGISTRATION_NAME]: expected,
        'other-server': { type: 'stdio', command: 'foo', args: [] },
      },
    })
    const r = computeRegistrationRemoval(current)
    expect(r.changed).toBe(true)
    expect(r.reason).toBe('removed')
    const next = parse(r.nextContent!)
    expect(next.otherKey).toBe('preserved')
    const servers = next.mcpServers as Record<string, unknown>
    expect(SELF_REGISTRATION_NAME in servers).toBe(false)
    expect(servers['other-server']).toBeDefined()
  })

  it('leaves an empty mcpServers object behind rather than deleting the key', () => {
    // Subtle: deleting the parent key would surprise users who inspect the
    // file. An empty object is a clearer "we cleaned up after ourselves".
    const current = JSON.stringify({
      mcpServers: { [SELF_REGISTRATION_NAME]: expected },
    })
    const r = computeRegistrationRemoval(current)
    expect(r.changed).toBe(true)
    const servers = (parse(r.nextContent!).mcpServers ?? {}) as Record<string, unknown>
    expect(servers).toEqual({})
  })
})
