---
name: fix-bug
description: Use when diagnosing or fixing a bug. Loads only the module-level context relevant to the affected code, not the full product vision.
trigger: User says things like "bug", "broken", "isn't working", "crashes", "fix", or describes incorrect behavior.
---

# Fixing a bug

## Context to load

- The folder-level `CLAUDE.md` for the affected area, if present. Local conventions are more relevant here than product strategy.
- Rules in [.claude/rules/](../../.claude/rules/) that match the affected paths will auto-load.
- Don't load vision or scope docs unless the bug is actually a scope issue.

## The process

1. **Reproduce first.** Do not propose a fix before you can make the bug happen. "Probably because X" is not a diagnosis.
2. **Write a failing test** if the affected code is testable. The failing test is the fix's receipt — it proves you found the right thing and proves the fix holds.
3. **Find the root cause.** A symptom-only fix usually creates another bug. If you can't explain *why* the bug happened, you haven't finished diagnosing.
4. **Keep the diff scoped.** Do not refactor adjacent code "while you're there." File a follow-up instead.
5. **Don't add error handling for cases that can't occur.** A bug fix is not an excuse to dress up surrounding code.

## When the bug reveals a wrong assumption

Sometimes the root cause is an assumption baked into the design, not a local mistake. Flag this to the user explicitly — the right fix may be a design change, not a patch. Don't quietly work around it.
