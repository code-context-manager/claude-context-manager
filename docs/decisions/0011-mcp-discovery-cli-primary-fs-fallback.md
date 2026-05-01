# 0011 — MCP discovery: CLI primary, filesystem fallback

## Problem

Claude Code resolves MCP servers from at least four locations:

- `~/.claude/settings.json` — user scope
- `.claude/settings.json` — project settings (rare for MCP)
- `.mcp.json` — version-controlled project MCP config
- `~/.claude.json` — top-level `mcpServers` (user scope) and
  `projects[<path>].mcpServers` (Claude's `local` scope: user-private,
  project-bound)

It also loads servers that aren't on disk in any of those files at all:
plugin-bundled and marketplace-installed servers, which the harness wires in
at startup. We discovered this when the user noticed that the
`claude-context-manager` MCP server (which Claude was actively using) didn't
appear in our inventory even after we expanded the filesystem scan to all
four paths above.

Statically replicating Claude's full resolution chain — including plugin
discovery — means staying in lockstep with Claude Code's internals forever.

## Decision

**Primary source: shell out to `claude mcp list` from the project's cwd.**
Claude is its own resolver, so by definition its output covers every server
it actually knows about, including bundled and plugin-provided ones.

**Fallback: scan the four JSON config files** described above.

The fallback runs only when the CLI is unavailable (`claude` not on PATH,
non-zero exit, parse failure). When the CLI returns successfully — even with
zero servers — we trust it exclusively.

This pattern (ask Claude → fall back to filesystem) is the template for
future discovery work where Claude exposes a CLI subcommand: skills,
agents, hooks, plugins. Where it doesn't, we stay on filesystem-only.

## Why not merge both sources?

Considered: run both, merge by name, surface "config drift" (e.g. server in
`.mcp.json` but listed in `disabledMcpjsonServers`).

Rejected for v1:

- Two sources name and scope things differently — dedup gets noisy and
  prone to false positives that confuse the inventory.
- The CLI is authoritative when present; if it disagrees with our
  filesystem read, the CLI wins by definition. Merging just adds a code
  path that we'd never trust over the CLI anyway.
- The drift use case is a debugging/diagnostic feature, not part of "what
  context is loaded for this project." If/when we want it, it belongs in a
  separate view, not the inventory.

Worth revisiting if users repeatedly ask "why is my `.mcp.json` server not
loading?" — then a dedicated "config drift" view makes sense.

## Implementation

- [src/core/claude-cli.ts](../../src/core/claude-cli.ts) — `ClaudeCli`
  interface + `parseMcpListOutput` (env-neutral, lives in `core/`).
- [src/main/claude-cli.ts](../../src/main/claude-cli.ts) — `nodeClaudeCli`
  shells out via the user's login shell (`process.env.SHELL`) so PATH
  wrappers and shims behave the same as in the user's terminal.
- [src/core/scanner.ts](../../src/core/scanner.ts) — `scanProject(fs,
  projectPath, cli?)`. The `cli` arg is optional; absent means
  filesystem-only (used by the bundled MCP server in `src/mcp/index.ts`,
  which intentionally avoids recursing into `claude`).

The parser is permissive: section headers (`Project:`, `User:`, `Local:`)
set scope for the lines that follow; each subsequent line's first
name-shaped token is taken as the server name. If `claude mcp list` ever
adds `--json`, prefer that and treat the text parser as a compatibility
shim.
