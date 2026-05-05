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

## Local development

Requires [Node.js](https://nodejs.org/) 18+ and [pnpm](https://pnpm.io/) 10+. If you don't have pnpm:

```sh
npm install -g pnpm
```

Install dependencies (the `postinstall` step also builds the bundled MCP server):

```sh
pnpm install
```

Run the desktop app in dev mode (hot reload):

```sh
pnpm dev
```

Other commands:

```sh
pnpm build         # production build of the Electron app
pnpm preview       # preview the production build
pnpm test          # run tests
pnpm mcp:build     # rebuild the bundled MCP server
pnpm dist:win      # package a Windows installer
pnpm dist:mac      # package macOS artifacts
pnpm dist:linux    # package Linux artifacts
```

### Using this in Claude Code

The app self-registers its bundled MCP server at user scope on launch. The first time you open the desktop app (whether installed or `pnpm dev`), it writes a `mcpServers["claude-context-manager"]` entry to `~/.claude.json` pointing at its bundled MCP binary. Restart Claude Code afterward and tools like `get_project_static_load`, `probe_file`, and `get_active_session` are available in every project.

The registration is idempotent — only rewritten when the path drifts (e.g. you moved the dev checkout or reinstalled the app).

#### Removing the registration

Homebrew, Scoop, NSIS (.exe), and `.deb` uninstalls clean up the registration automatically. If you installed via direct `.dmg` drag-to-trash or `.AppImage`, remove it manually:

```sh
claude mcp remove claude-context-manager -s user
```

## Releasing

Push a `v*` tag (e.g. `git tag v0.1.0 && git push --tags`). The [release workflow](.github/workflows/release.yml) builds for all three platforms, publishes a GitHub Release, and bumps the [Homebrew tap](https://github.com/code-context-manager/homebrew-tap) and [Scoop bucket](https://github.com/code-context-manager/scoop-bucket) cask/manifest.
