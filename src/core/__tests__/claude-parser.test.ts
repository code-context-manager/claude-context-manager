import { describe, it, expect } from 'vitest'
import {
  parseFrontmatter,
  parseRuleFrontmatter,
  parseSkillFrontmatter,
  parseSettingsJson,
  parseUserClaudeJson,
} from '../claude-parser'

describe('parseFrontmatter', () => {
  it('parses frontmatter with body', () => {
    const content = `---
description: A test rule
alwaysApply: true
---
This is the body.`

    const result = parseFrontmatter(content)
    expect(result.frontmatter.description).toBe('A test rule')
    expect(result.frontmatter.alwaysApply).toBe(true)
    expect(result.body).toBe('This is the body.')
  })

  it('parses list values in frontmatter', () => {
    const content = `---
paths:
  - src/**/*.ts
  - lib/**/*.js
---
Body here.`

    const result = parseFrontmatter(content)
    expect(result.frontmatter.paths).toEqual(['src/**/*.ts', 'lib/**/*.js'])
  })

  it('returns full content as body when no frontmatter', () => {
    const content = 'Just some markdown content.'
    const result = parseFrontmatter(content)
    expect(result.frontmatter).toEqual({})
    expect(result.body).toBe(content)
  })
})

describe('parseRuleFrontmatter', () => {
  it('extracts rule metadata', () => {
    const content = `---
description: Enforce naming
paths:
  - src/components/**
alwaysApply: false
---
Use PascalCase for components.`

    const { meta, body } = parseRuleFrontmatter(content)
    expect(meta.description).toBe('Enforce naming')
    expect(meta.paths).toEqual(['src/components/**'])
    expect(meta.alwaysApply).toBe(false)
    expect(body).toBe('Use PascalCase for components.')
  })
})

describe('parseSkillFrontmatter', () => {
  it('extracts skill metadata', () => {
    const content = `---
name: commit
description: Create a git commit
trigger: when user says /commit
---
Instructions here.`

    const { meta } = parseSkillFrontmatter(content)
    expect(meta.name).toBe('commit')
    expect(meta.description).toBe('Create a git commit')
    expect(meta.trigger).toBe('when user says /commit')
  })
})

describe('parseSettingsJson', () => {
  it('parses MCP server configs', () => {
    const json = JSON.stringify({
      mcpServers: {
        'my-server': {
          command: 'node',
          args: ['server.js'],
          env: { PORT: '3000' },
        },
      },
    })

    const { mcpServers } = parseSettingsJson(json)
    expect(mcpServers).toHaveLength(1)
    expect(mcpServers[0].name).toBe('my-server')
    expect(mcpServers[0].command).toBe('node')
    expect(mcpServers[0].args).toEqual(['server.js'])
  })

  it('handles missing mcpServers', () => {
    const { mcpServers } = parseSettingsJson('{}')
    expect(mcpServers).toEqual([])
  })

  it('handles invalid JSON', () => {
    const { mcpServers, hooks } = parseSettingsJson('not json')
    expect(mcpServers).toEqual([])
    expect(hooks).toEqual([])
  })

  it('parses hooks block', () => {
    const json = JSON.stringify({
      hooks: {
        PreToolUse: [
          {
            matcher: 'Bash',
            hooks: [{ type: 'command', command: 'echo running bash' }],
          },
        ],
        PostToolUse: [
          {
            matcher: '*',
            hooks: [{ type: 'command', command: 'echo done' }],
          },
        ],
      },
    })
    const { hooks } = parseSettingsJson(json)
    expect(hooks).toHaveLength(2)
    expect(hooks[0].event).toBe('PreToolUse')
    expect(hooks[0].matcher).toBe('Bash')
    expect(hooks[1].event).toBe('PostToolUse')
  })
})

describe('parseUserClaudeJson', () => {
  it('separates user-scope and project-scope MCP servers', () => {
    const json = JSON.stringify({
      mcpServers: { 'user-wide': { command: 'node' } },
      projects: {
        '/Users/me/project-a': {
          mcpServers: { 'project-a-only': { command: 'python' } },
        },
        '/Users/me/project-b': {
          mcpServers: { 'project-b-only': { command: 'go' } },
        },
      },
    })
    const result = parseUserClaudeJson(json, '/Users/me/project-a')
    expect(result.userScopeMcp.map((s) => s.name)).toEqual(['user-wide'])
    expect(result.projectScopeMcp.map((s) => s.name)).toEqual(['project-a-only'])
  })

  it('returns empty arrays when project is unknown', () => {
    const json = JSON.stringify({ projects: { '/other': { mcpServers: {} } } })
    const result = parseUserClaudeJson(json, '/missing')
    expect(result.userScopeMcp).toEqual([])
    expect(result.projectScopeMcp).toEqual([])
  })

  it('handles missing fields and invalid JSON', () => {
    expect(parseUserClaudeJson('{}', '/p')).toEqual({
      userScopeMcp: [],
      projectScopeMcp: [],
    })
    expect(parseUserClaudeJson('not json', '/p')).toEqual({
      userScopeMcp: [],
      projectScopeMcp: [],
    })
  })
})
