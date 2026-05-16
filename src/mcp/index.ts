#!/usr/bin/env node
/**
 * Claude Context Manager — MCP server.
 *
 * Read-only stdio server that exposes the same indexer Claude Context
 * Manager's desktop app uses. Tools are thin adapters over `core/`.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { nodeFsReader } from '../core/fs'
import { probeFile } from '../core/probe'
import { scanProject } from '../core/scanner'
import { listSessionsForProject } from '../core/sessions'
import { buildSessionView } from '../core/session-view'
import {
  computeFileStaticLoad,
  computeProjectStaticLoad,
} from '../core/static-load'

const fs = nodeFsReader

const server = new McpServer({
  name: 'claude-context-manager',
  version: '0.1.0',
})

server.registerTool(
  'probe_file',
  {
    title: 'Probe context for file',
    description:
      'Given a project root and a target file path inside it, return every context source ' +
      'that will load when Claude Code works on that file: global/project/folder CLAUDE.md, ' +
      'matching rules, MEMORY.md window, MCP server descriptions, conditionally-loaded skills. ' +
      'Each entry includes its file path, token estimate, and load-trigger ("certain" vs "conditional").',
    inputSchema: {
      projectPath: z.string().describe('Absolute path to the project root.'),
      targetPath: z
        .string()
        .describe('Absolute path to the file you want to know the context for.'),
    },
  },
  async ({ projectPath, targetPath }) => {
    const result = await probeFile(fs, projectPath, targetPath)
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  },
)

server.registerTool(
  'list_sources',
  {
    title: 'List all context sources for project',
    description:
      'Return every context source registered for a project (CLAUDE.md at every scope, rules, ' +
      'skills, memory, MCP servers) regardless of which file is being worked on. Use this for ' +
      'a project-wide inventory; use probe_file for a per-file load picture.',
    inputSchema: {
      projectPath: z.string().describe('Absolute path to the project root.'),
    },
  },
  async ({ projectPath }) => {
    const sources = await scanProject(fs, projectPath)
    return {
      content: [{ type: 'text', text: JSON.stringify(sources, null, 2) }],
    }
  },
)

server.registerTool(
  'get_project_static_load',
  {
    title: 'Get the always-on static context bundle for a project',
    description:
      'Return everything Claude Code injects into ANY session in this project, ' +
      'before any tool calls fire. Pure function of disk state. Includes synthetic ' +
      'system-prompt and env-info entries (with estimated token counts), global ' +
      'CLAUDE.md, project CLAUDE.md, MEMORY.md (loaded window), always-apply rules, ' +
      'and MCP server index entries. Each entry has scope ("global" or "project"), ' +
      'kind, label, token estimate, and filePath when on disk.',
    inputSchema: {
      projectPath: z.string().describe('Absolute path to the project root.'),
    },
  },
  async ({ projectPath }) => {
    const result = await computeProjectStaticLoad(fs, projectPath)
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  },
)

server.registerTool(
  'get_file_static_load',
  {
    title: 'Get the per-file static context that loads when a file is in scope',
    description:
      "Return what Claude Code additionally injects when a specific file is in " +
      "scope: folder-chain CLAUDE.mds along the path from project root to the " +
      "file's directory, plus path-scoped rules whose globs match. Does NOT " +
      'include the project-wide static bundle (use get_project_static_load for ' +
      'that). Compose both together to predict what is loaded for any file.',
    inputSchema: {
      projectPath: z.string().describe('Absolute path to the project root.'),
      filePath: z
        .string()
        .describe('Absolute path to the file you are asking about.'),
    },
  },
  async ({ projectPath, filePath }) => {
    const result = await computeFileStaticLoad(fs, projectPath, filePath)
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  },
)

server.registerTool(
  'list_sessions',
  {
    title: 'List Claude Code sessions for project',
    description:
      'Return a summary of every Claude Code session transcript stored under ' +
      '~/.claude/projects/<project>/, newest first. Each entry has the session ' +
      'id, file path, started/ended timestamps, message count, and the first ' +
      "user prompt (truncated). Use the id with get_active_session.",
    inputSchema: {
      projectPath: z.string().describe('Absolute path to the project root.'),
    },
  },
  async ({ projectPath }) => {
    const sessions = await listSessionsForProject(fs, projectPath)
    return {
      content: [{ type: 'text', text: JSON.stringify(sessions, null, 2) }],
    }
  },
)

server.registerTool(
  'get_active_session',
  {
    title: 'Get loaded-context snapshot for a session',
    description:
      'Return the live "what is loaded in context" snapshot for one Claude Code ' +
      'session — the same data the desktop Session view shows. Defaults to the ' +
      'most recently active session for the project — including sessions from ' +
      'git worktrees of the same project — and reports `lastActivityAt` and a ' +
      '`staleSession` flag so a long-idle session is not mistaken for the live ' +
      'context. Pass sessionId for a specific one (use list_sessions to ' +
      'discover ids). Each loaded file carries ' +
      'a `reasons` array (provenance): tool-call entries derived from the JSONL ' +
      'transcript, project-static / global-static entries from the auto-loaded ' +
      'bundle, and file-static entries showing which loaded file pulled in a ' +
      'folder CLAUDE.md or path-scoped rule (via `triggeredBy`). Also includes ' +
      'message counts, last reported usage, system-prompt and env-info sizes, ' +
      'system tools invoked, MEMORY.md and CLAUDE.md chain entries, skills ' +
      'invoked, and MCP schema fetches.',
    inputSchema: {
      projectPath: z.string().describe('Absolute path to the project root.'),
      sessionId: z
        .string()
        .optional()
        .describe(
          'Optional session UUID (filename in ~/.claude/projects/<project>/ minus the .jsonl extension). Omit for the latest session.',
        ),
    },
  },
  async ({ projectPath, sessionId }) => {
    const view = await buildSessionView(fs, projectPath, sessionId)
    if (!view) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: sessionId
                  ? 'Session JSONL not found or unreadable'
                  : 'No sessions found for project',
                projectPath,
                ...(sessionId ? { sessionId } : {}),
              },
              null,
              2,
            ),
          },
        ],
      }
    }
    // Return the snapshot only — the on-disk file tree the desktop UI uses
    // is large and redundant for programmatic consumers; snapshot.files is
    // the flat list of every file currently loaded.
    return {
      content: [{ type: 'text', text: JSON.stringify(view.snapshot, null, 2) }],
    }
  },
)

async function main(): Promise<void> {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  // stderr only — stdout is the MCP transport.
  console.error('claude-context-mcp failed to start:', err)
  process.exit(1)
})
