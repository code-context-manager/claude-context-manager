---
name: implement-feature
description: Use when implementing a feature whose approach has already been planned or agreed. Loads folder-level context and matching rules — not product vision.
trigger: User says things like "implement", "build it", "let's write", "code this up", or references a plan that has already been agreed.
---

# Implementing a feature

## Context to load

1. Folder-level `CLAUDE.md` in the directory you'll edit, if present.
2. Rules in [.claude/rules/](../../.claude/rules/) whose `paths:` globs match the files you're touching will auto-load — honor them.
3. [docs/state/](../../docs/state/) if you don't already know the current state of the project.

You do **not** need [docs/vision.md](../../docs/vision.md) or product strategy here. That context was consumed during planning. Spending tokens on it now crowds out the context that matters for writing good code.

## While implementing

- Respect the **scope of the planned feature**. If you find something adjacent that needs changing, flag it — don't fold it in silently.
- If a rule blocks the planned approach, **stop and raise it**. Don't override silently. The rule might be the wrong rule; that is a conversation, not a workaround.
- **Components stay small.** One responsibility per file. Filesystem access goes through `src/main/` or `src/core/fs.ts`. Parsers get tests.
- **Keep the diff reviewable.** If the user can't read the diff in a few minutes, it's doing too much.

## When done

- Verify the feature works, not only that types check and tests pass.
- Folder-level context that changed? Update the folder `CLAUDE.md` in the same commit.
- If the work shifted any state-of-the-world fact (deployment, users, contributors, tooling), update [docs/state/](../../docs/state/).
