# claude-context-manager

Context-driven development for Claude Code — a desktop app that visualizes and curates the context Claude Code loads.

## Install

| Platform | Command |
| --- | --- |
| macOS | `brew install --cask code-context-manager/tap/claude-context-manager` |
| Windows | `scoop bucket add ccm https://github.com/code-context-manager/scoop-bucket` then `scoop install claude-context-manager` |
| Linux (.deb) | Download the `.deb` from [Releases](https://github.com/code-context-manager/claude-context-manager/releases/latest) and run `sudo apt install ./claude-context-manager_*.deb` |
| Linux (.AppImage) | Download the `.AppImage` from [Releases](https://github.com/code-context-manager/claude-context-manager/releases/latest), `chmod +x` it, and run |

Or grab the `.dmg` / `.exe` directly from the [Releases page](https://github.com/code-context-manager/claude-context-manager/releases/latest).

### First-run notes for direct downloads

Builds are not code-signed yet (Apple Developer Program enrollment is deferred until the project has real users — see [.claude/skills/release-and-package.md](.claude/skills/release-and-package.md)). One-time workarounds for direct downloads:

- **macOS `.dmg`**: Gatekeeper blocks unsigned apps on double-click. Right-click the app in `/Applications` → **Open** the first time, or run `xattr -d com.apple.quarantine "/Applications/Claude Context Manager.app"`. Homebrew users skip this — `brew` strips the quarantine attribute.
- **Windows `.exe`**: SmartScreen shows a blue popup. Click **More info** → **Run anyway**. Scoop users skip this.
- **Linux**: no warnings.

### Updates

The app checks for updates on startup and downloads them in the background. Restart to apply. This works regardless of how you installed (Homebrew / Scoop / direct).

## Using this in Claude Code (development)

Clone and `pnpm install` — the postinstall step builds the bundled MCP server, and [`.mcp.json`](.mcp.json) registers it for the project. On your first Claude Code session in this repo you'll be prompted to approve the project-scoped server; once approved, tools like `get_project_static_load`, `probe_file`, and `get_active_session` are available.

## Releasing

Push a `v*` tag (e.g. `git tag v0.1.0 && git push --tags`). The [release workflow](.github/workflows/release.yml) builds for all three platforms, publishes a GitHub Release, and bumps the [Homebrew tap](https://github.com/code-context-manager/homebrew-tap) and [Scoop bucket](https://github.com/code-context-manager/scoop-bucket) cask/manifest.
