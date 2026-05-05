#!/bin/sh
# Debian prerm hook for the .deb package.
#
# Wired in via package.json `build.deb.fpm` as `--before-remove=...`. Runs
# while the app binary still exists (prerm, not postrm) so we can invoke it
# to clean up its user-scope MCP entry from ~/.claude.json before files are
# removed.
#
# Best-effort: if the binary is missing or fails, don't block uninstall.

set -e
APP="/opt/Claude Context Manager/claude-context-manager"
if [ -x "$APP" ]; then
  "$APP" --cleanup-mcp-registration || true
fi
exit 0
