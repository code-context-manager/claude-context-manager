; Custom NSIS macros for Claude Context Manager.
;
; Picked up by electron-builder via `build.nsis.include` in package.json.
;
; What this does:
;   On uninstall, run the app once with --cleanup-mcp-registration so it can
;   remove its user-scope entry from ~/.claude.json before its own files are
;   deleted. Without this, uninstalling leaves stale MCP wiring behind that
;   Claude Code would then fail to spawn on every session.

!macro customUnInstall
  ExecWait '"$INSTDIR\Claude Context Manager.exe" --cleanup-mcp-registration'
!macroend
