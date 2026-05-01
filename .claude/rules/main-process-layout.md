---
description: Main process layout — IPC handlers centralized, no UI or product logic, no renderer imports.
paths:
  - src/main/**
alwaysApply: false
---

# Main process layout

- **IPC handlers are centralized** in `src/main/ipc-handlers.ts`. Don't scatter `ipcMain.handle(...)` calls across feature files.
- **Scanning / parsing logic** lives in `src/core/` (e.g. `src/core/scanner.ts`), not inline in IPC handlers. Handlers are thin adapters.
- **Do not import from `src/renderer/`** — the main process must build and run without the renderer being compiled.
- **Return plain, serializable data over IPC.** No class instances, no `Date` vs `string` inconsistency, no functions in payloads.
- **Error handling at the IPC boundary:** catch errors inside the handler, return a well-typed error shape rather than throwing across the process boundary.

File watchers go in `src/main/file-watcher.ts`. Debounce updates before pushing them to the renderer.
