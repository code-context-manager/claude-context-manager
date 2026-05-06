# Claude Context Manager

## Premise

AI-assisted coding breaks down when Claude lacks context. The code is easy; the business knowledge, conventions, and past decisions are not. This tool makes the context Claude Code already consumes visible, auditable, and curatable.

See [docs/vision.md](docs/vision.md) for the full premise.

## Development model

Key context about the state of the world is recorded in [docs/state/facts.md](docs/state/facts.md) — who works on this, where it runs, who uses it. Read it at the start of a session, and keep it current: when you learn something new about the state of the world, update it in the same change. Ask if something is unclear.

Docs in this project record facts, not rules. Rules are inferred from facts at the point of use. If a rule keeps getting violated, the missing piece is usually a fact, not a stronger rule.

## MCP server changes need a Claude Code restart

This repo ships an MCP server (`out/mcp/index.mjs`) that Claude Code spawns once per session as a stdio child process. Edits to `src/mcp/` or `src/core/` only reach a running Claude Code session after the child process is restarted — rewriting the file alone does nothing. `pnpm dev` keeps `out/mcp/index.mjs` current via an esbuild watcher, but the user must trigger the restart: `/mcp` → Retry on `claude-context-manager`, or restart Claude Code. If verifying behaviour against a session and your changes don't seem to take effect, this is almost always why.
