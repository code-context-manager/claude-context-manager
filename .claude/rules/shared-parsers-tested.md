---
description: Anything in src/core that parses a Claude Code file format must have unit tests.
paths:
  - src/core/**
alwaysApply: true
---

# Core parsers must be tested

`src/core/` is the heart of this app. Its parsers — for `CLAUDE.md` frontmatter, `.claude/rules/*.md`, `.claude/skills/*.md`, `settings.json`, session JSONL, `MEMORY.md` — are what makes the tool correct. Bugs here propagate into every view in the UI.

## Requirements

- Every exported parser function has a test in `src/core/__tests__/`.
- Tests cover at minimum: happy path, missing frontmatter, malformed input, empty input.
- Token estimation and path utilities are also tested. The UI's budget view depends on their accuracy.

## What counts as a parser

Any function that accepts a raw string (or file path) representing one of the Claude Code file formats and returns a structured shape. If it's doing string-to-struct transformation on a format this app cares about, it's a parser.

## Environment neutrality

Code in `src/core/` runs in both the main and renderer processes (and in the MCP server). It must not:

- Import `electron`, `fs`, or any Node-only module at module scope.
- Depend on `window` or DOM APIs.
- Assume one process or the other.

Filesystem helpers that genuinely need Node belong in `src/core/fs.ts` (the single bridge) or in `src/main/`, not scattered across `src/core/`.
