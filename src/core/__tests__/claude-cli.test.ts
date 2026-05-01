import { describe, it, expect } from 'vitest'
import { parseMcpListOutput } from '../claude-cli'

describe('parseMcpListOutput', () => {
  it('returns [] for empty output', () => {
    expect(parseMcpListOutput('')).toEqual([])
  })

  it('extracts plain server names', () => {
    const out = `
my-server
another-one
    `
    expect(parseMcpListOutput(out)).toEqual([
      { name: 'my-server' },
      { name: 'another-one' },
    ])
  })

  it('attributes scope from section headers', () => {
    const out = `
Project:
  shared-server
User:
  personal-server
Local:
  project-private-server
    `
    const parsed = parseMcpListOutput(out)
    expect(parsed).toEqual([
      { name: 'shared-server', scope: 'project' },
      { name: 'personal-server', scope: 'user' },
      { name: 'project-private-server', scope: 'local' },
    ])
  })

  it('parses lines with command/decorations after the name', () => {
    const out = `
claude-context-manager: node ./out/mcp/index.mjs ✓
some-other-tool      stdio  python script.py
    `
    const names = parseMcpListOutput(out).map((s) => s.name)
    expect(names).toEqual(['claude-context-manager', 'some-other-tool'])
  })

  it('ignores "No MCP servers configured" placeholder', () => {
    expect(parseMcpListOutput('No MCP servers configured.')).toEqual([])
  })

  it('skips bullets and decorative lines', () => {
    const out = `
# servers
- foo
real-server
    `
    expect(parseMcpListOutput(out).map((s) => s.name)).toEqual(['real-server'])
  })
})
