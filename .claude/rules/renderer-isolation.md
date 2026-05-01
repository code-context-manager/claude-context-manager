---
description: Renderer code must not use Node or Electron APIs directly. All OS access flows through the preload IPC bridge.
paths:
  - src/renderer/**
alwaysApply: false
---

# Renderer isolation

The renderer runs in a sandboxed Chromium process. It must not import Node APIs or touch the OS directly. All backend capability goes through the preload bridge.

## Hard bans in `src/renderer/`

- No `fs`, `path`, `os`, `child_process`, `crypto`, `stream`, or any Node built-in.
- No `electron` imports (the renderer must not see `ipcRenderer`, `shell`, `app`, etc.).
- No `process.platform` branches, no `__dirname`, no `require`.

## How to add backend capability

1. Add an IPC handler in `src/main/ipc-handlers.ts`.
2. Expose it on the preload-surface API in `src/preload/`.
3. Call it from the renderer through that API.

If you are tempted to shortcut this, stop and ask — there is usually a reason the renderer is sandboxed, and "it would be easier" is not it.

## Why

Electron's renderer is the security boundary. A cross-site script or a malformed file read cannot execute arbitrary code if the renderer has no Node surface. This app reads arbitrary files under `~/.claude/`; we cannot afford to soften that boundary.
