---
description: On the session page, the Other context panel (NonFsTreeGroup) is for non-filesystem items only. Anything that exists as a file on disk belongs in the file tree, never both.
paths:
  - src/renderer/src/components/session/**
  - src/renderer/src/components/shell/detail-views/NonFsSectionDetail.tsx
  - src/core/loaded-context.ts
  - src/core/session-view.ts
alwaysApply: false
---

# Other context is non-filesystem only (session page)

This rule applies **only to the session page**. The inventory and probe pages have their own models and are out of scope — they may surface file-shaped items however suits them.

On the session page, the "Other context" panel (`NonFsTreeGroup`) exists to surface things that have no on-disk path: the message log, the synthetic system prompt, env-info, the count of system tools invoked, the count of skill invocations, MCP tool-schema fetch records, etc. The session file tree is the canonical home for everything else.

## Rule

If an item has a real `filePath` on the user's machine, render it in the file tree (project tree or External Reads). Do not give it a row in `NonFsTreeGroup` or a case in `NonFsSectionDetail`.

This applies even when the file is auto-loaded (MEMORY.md, CLAUDE.md, rules). Auto-loaded files belong in the tree with a `project-static` / `global-static` reason badge — that's exactly what the badge system is for.

## Why

- Two homes for one thing means two truths to keep in sync. `snapshot.memory` and a tree entry for MEMORY.md drifted apart in early versions; only one was populated by the static-load layer.
- Users scan the file tree to answer "what files are loaded?" If a file is missing from there because it was promoted to "Other context", the tree lies.
- "Other context" becomes a junk drawer if anything file-shaped can land there.

## What counts as non-filesystem

- Synthetic/internal: system prompt, env info — captured from JSONL, no path.
- Counts and aggregates: number of messages, list of tool names invoked, list of skill invocations.
- Provenance summaries (CLAUDE.md *chain*) — the chain itself is a non-fs concept, even though each entry has a path. The individual files still appear in the tree; the chain row is a directory-of-provenance, not a duplicate listing.

## What does NOT count

- MEMORY.md — file on disk. Tree only.
- Any `.md` file under `~/.claude/` — file on disk. External Reads section of the tree.
- Skill `SKILL.md` files — files on disk. Use the skill invocation row only as a count/index.

## When you're tempted to add a row

If a row would just say "{file} — {tokens}" or "Not loaded" depending on whether a file is present, you want the file tree, not Other context. The reason badges + tooltip already convey this.

## Folder docs alternative

If a region of code needs deeper context than a rule provides, prefer a folder-scoped `CLAUDE.md` in that directory over expanding this rule. Rules say "do this"; folder CLAUDE.md says "this is what's here and why".
