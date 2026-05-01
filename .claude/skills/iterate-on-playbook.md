---
name: iterate-on-playbook
description: Use when working on the Playbook surface — adding or editing entries in the sibling claude-context-playbook repo, or changing how the desktop app loads, validates, or renders Playbook entries (src/core/playbook.ts and renderer Playbook views). The Playbook is experimental; this skill loads the context needed to iterate on it.
trigger: User mentions "playbook", "playbook entry", "approaches", "tools list", or is editing files under src/core/playbook.ts, the Playbook renderer views, or the sibling claude-context-playbook repo.
---

# Iterating on the Playbook

## Context to load

1. [docs/playbook.md](../../docs/playbook.md) — what the Playbook is, the two categories (Approaches, Tools), the data-source resolution order, and what entries should look like.
2. The sibling repo `../claude-context-playbook/` if present — read `schema/entry.schema.json` for the entry contract, and skim a couple of existing entries under `entries/approaches/` and `entries/tools/` for the established shape.
3. Any folder-level CLAUDE.md and matching rules along the path you're editing will auto-load.

## Facts that shape this work

- The Playbook surface is experimental. The shape of entries, the categories, and the resolution order are all still allowed to change.
- Reading raw entries from a local sibling checkout and reading a compiled `playbook.json` produce the same in-memory shape. The schema is the contract.
- Local sibling checkout is the supported development path. A contributor editing an entry should see the change reflected on the next refresh in the desktop app, with no fetch and no rebuild.

## Common shapes of work

- **Adding or editing an entry** — work happens in the sibling repo, not this one. Validate against the schema. Keep entry copy short and link out for depth; the Playbook is a discovery surface, not a tutorial.
- **Changing the entry schema** — both repos are affected. Update `schema/entry.schema.json` in the sibling repo and the parser in `src/core/playbook.ts` together. Existing entries must still validate, or migrate them in the same change.
- **Changing how the app loads Playbook data** — `src/core/playbook.ts` owns resolution (local → cached → remote). Preserve the order; the local-checkout path is first-class, not a debug hack.
- **Changing how the app renders Playbook entries** — renderer-only; no schema or core changes needed.

## Scope discipline

The Playbook is experimental — that's a license to iterate, not to expand scope. A change that touches both repos, the schema, and the renderer in one pass is almost always too much. Pick one layer, ship it, then move.
