---
description: TypeScript strict-mode expectations for all TS/TSX in this repo.
paths:
  - src/**/*.ts
  - src/**/*.tsx
alwaysApply: false
---

# TypeScript strictness

- Strict mode is on. Do not add `any` to escape it.
- Use `import type { Foo } from '...'` for type-only imports.
- Do not suppress type errors with `@ts-ignore`, `@ts-expect-error`, or unsafe casts (`as unknown as Foo`) without a one-line comment explaining the specific reason.
- Prefer discriminated unions over boolean flag stacks for state that can't be true in combination (e.g. loading/error/data).
- Don't export types that only one file uses. Keep them local until a second consumer appears.

Why: This codebase has a small surface area and a small team (the user + Claude). Keeping types tight is cheap now; it gets expensive later.
