# Project state

_Last updated: 2026-04-26_

## Stage

Greenfield, early. No release, no external users, no deployment target chosen yet. The repo is in active scaffolding — expect file layout to keep moving.

## People

- **One human developer.** Claude (this assistant) is the primary developer; the human directs, reviews, and decides.
- No other contributors, no review queue, no on-call.

## Implications for how we work

- **No backwards-compatibility constraints.** There are no existing users or shipped versions. Renames, restructures, and breaking changes are free — just keep the diff focused.
- **Docs serve future-Claude and future-human, not a team.** Optimize for "will this still be readable in three months when nobody remembers the context," not for onboarding strangers.
- **No deployment, CI, or release process to respect yet.** When one is added, record it here.

## Sibling repos

- [`claude-context-playbook`](../../../claude-context-playbook) — the data the Playbook surface reads. Expected to live as a sibling directory during local development; the app prefers a local checkout over a remote fetch when one is present. See [docs/playbook.md](../playbook.md).

## Discovery strategy

When surfacing things Claude Code knows about (MCP servers, and eventually
skills/agents/hooks/plugins), prefer asking Claude itself via its CLI over
parsing config files. The CLI is the source of truth and covers
plugin/bundled items that aren't written to disk anywhere we can find them.
Filesystem scanning stays as a fallback for when the CLI isn't installed.
See [decisions/0011-mcp-discovery-cli-primary-fs-fallback.md](../decisions/0011-mcp-discovery-cli-primary-fs-fallback.md).

## What's not yet decided

- Where/how the app is distributed (this is an Electron app per [docs/vision.md](../vision.md), but no packaging or update channel exists).
- Whether there will ever be more than one developer.

Update this file when any of the above changes.
