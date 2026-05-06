# Facts

_Last updated: 2026-05-05._

Durable facts about the state of the world for this project. Facts only — no rules, no instructions, no "implications." Rules should be inferable from the facts; if they aren't, that's a missing fact, not a missing rule.

## Stage

- Greenfield. No external users yet.
- The repo is in active scaffolding; file layout is still moving.

## Distribution

- Releases are tag-driven: pushing a `v*` tag runs [.github/workflows/release.yml](../../.github/workflows/release.yml), which builds with `electron-builder` on macOS / Windows / Linux runners and publishes artifacts to a GitHub Release.
- Targets: macOS `.dmg` + `.zip` (arm64 and x64 in one job, so `latest-mac.yml` lists both arches), Windows NSIS `.exe` + `.zip` (x64), Linux `.AppImage` + `.deb` (x64).
- macOS Apple Developer enrollment is deferred — builds are unsigned. Homebrew installs strip the quarantine attribute so they "just work"; direct `.dmg` downloads require a one-time right-click → Open.
- Auto-updates run via `electron-updater` on app startup (all platforms, all install channels).
- After each release, the workflow pushes updated formulae to the sibling repos `homebrew-tap` (cask, with `auto_updates true`) and `scoop-bucket` (manifest), authenticated via the `TAP_GITHUB_TOKEN` Actions secret.
- Uninstall hooks remove the user-scope MCP registration before files are deleted: NSIS `customUnInstall` macro (`build/installer.nsh`), Debian prerm script (`build/linux-before-remove.sh`, wired via `deb.fpm --before-remove`), Homebrew cask `uninstall_preflight`, and Scoop manifest `pre_uninstall`. All four invoke `<app-binary> --cleanup-mcp-registration`. AppImage and direct-`.dmg` drag-to-trash have no hook surface and leave the registration entry stranded — Claude Code fails loudly when spawning a non-existent binary, and the README documents the manual `claude mcp remove` command.

## People

- One human developer.
- Claude (this assistant) is the primary developer; the human directs, reviews, and decides.
- No other contributors. No review queue. No on-call.

## Product

- This is a desktop Electron app.
- It is a passive reader over the *content* the user reasons about (memory files, CLAUDE.md, playbook entries, project facts) — these are never auto-edited.
- It does auto-manage *plumbing* (MCP wiring): on launch it ensures a user-scope `mcpServers["claude-context-manager"]` entry in `~/.claude.json` pointing at the bundled MCP entry. The write is idempotent — only happens when the entry is missing or stale. The split between content (human-in-the-loop) and plumbing (convention-over-configuration) is the principle that resolves "passive reader" against "works out of the box."
- The MCP server itself is spawned by Claude Code as a stdio child process (per the user-scope registration), not by the desktop app. The desktop app and the MCP server share `src/core/` but run independently. There is no runtime IPC between them today; if curation features ever need shared in-memory state, the MCP would become a thin shim that forwards to the running app.
- Two surfaces: the Context Manager (what context is loaded) and the Playbook (what context could be added). The Playbook surface is deferred — its page component, IPC handlers, core logic, and sibling `claude-context-playbook` repo all still exist, but it is not reachable from the UI (no sidebar entry, no ⌘4 shortcut, no route in `App.tsx`).

## Code layout

- `src/main/` — Electron main process. IPC handlers live here.
- `src/preload/` — preload bridge between renderer and main.
- `src/renderer/` — UI. No direct Node or Electron APIs.
- `src/core/` — pure logic, parsers, filesystem readers. Reused by main and the bundled MCP server.
- `src/mcp/` — the bundled MCP server entry point.
- The MCP server is built into `out/mcp/index.mjs`. Registration happens at user scope on app launch (see "Product"); there is no project-scope `.mcp.json` in this repo.

## Data sources

- MCP server discovery uses the Claude Code CLI as the primary source of truth; filesystem scanning of `~/.claude.json` and project `.mcp.json` is a fallback for when the CLI isn't installed. The CLI covers plugin/bundled servers that aren't written to disk anywhere parseable.
- Session cost is reported in dollars (from the JSONL transcript's usage records), not as a percentage of the context window.

## Sibling repos

- [`claude-context-playbook`](../../../claude-context-playbook) — Playbook entries as YAML files validated against `schema/entry.schema.json`. The desktop app prefers a local sibling checkout over a remote fetch when one is present, then a cached `playbook.json`, then a remote fetch.
- [`homebrew-tap`](https://github.com/code-context-manager/homebrew-tap) — Homebrew tap. Holds `Casks/claude-context-manager.rb`, bumped automatically by the release workflow.
- [`scoop-bucket`](https://github.com/code-context-manager/scoop-bucket) — Scoop bucket for Windows. Holds `claude-context-manager.json`, bumped automatically by the release workflow.

## Documentation conventions

- This project uses fact-based documentation: docs record facts, not rules. Rules are inferred from facts at the point of use.
