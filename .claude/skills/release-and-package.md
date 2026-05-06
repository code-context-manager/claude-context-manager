---
name: release-and-package
description: Use when working on how this app is built, packaged, and distributed to end users — adding or changing the GitHub Actions release workflow, electron-builder config, the Homebrew tap, the Scoop bucket, electron-updater behavior, or release artifacts. Trigger on words like "release", "package", "installer", "distribute", "publish", "ship", ".dmg", ".exe", ".AppImage", "tap", "cask", "scoop", "sign", "notarize", "auto-update", or when the user asks how a user can install the app.
trigger: User asks about building installers, releasing a new version, distribution channels, install instructions, code signing, auto-updates, or troubleshooting the release pipeline.
---

# Releasing and packaging

## Context to load

1. [docs/state/facts.md](../../docs/state/facts.md) — current distribution stack lives under "Distribution" and the tap/bucket entries under "Sibling repos".
2. `package.json` — `build` block is the electron-builder config; `dist:*` scripts are how it's invoked.
3. [.github/workflows/release.yml](../../.github/workflows/release.yml) — the actual pipeline. Three platform jobs + a `bump-package-managers` job that updates the tap and bucket.
4. The sibling repos `code-context-manager/homebrew-tap` and `code-context-manager/scoop-bucket` — the workflow rewrites their formula/manifest on every release; don't hand-edit unless you also update the templated heredoc in `release.yml`.

## Stack in place

- **`electron-builder`** packages the `electron-vite` `out/` tree. Mac dmg+zip, Win nsis+zip, Linux AppImage+deb. Mac builds arm64+x64 in one invocation (single `latest-mac.yml`).
- **`electron-updater`** runs on app startup (`src/main/auto-updater.ts`) and pulls updates from GitHub Releases. Active on all platforms, all install channels.
- **Homebrew tap** (`homebrew-tap/Casks/claude-context-manager.rb`) — uses `auto_updates true` so brew won't fight `electron-updater`. CI rewrites the cask on each release with new version + dmg sha256s.
- **Scoop bucket** (`scoop-bucket/claude-context-manager.json`) — points at the Windows `.zip`. CI rewrites it on each release.
- **Tag-driven**: pushing `v*` runs the workflow. `workflow_dispatch` is also enabled for manual reruns.
- **Secrets used**: `GITHUB_TOKEN` (auto, for uploading release assets in this repo) and `TAP_GITHUB_TOKEN` (a fine-grained PAT with `contents: write` on the tap + bucket repos).

## Code signing — currently deferred

- **macOS Apple Developer Program ($99/yr) is deferred until the project has real users.** Without it, the unsigned `.dmg` triggers Gatekeeper's "app is damaged" dialog on direct download. The Homebrew install path sidesteps this entirely (brew strips the quarantine xattr), so the `brew install --cask` route remains the recommended one for Mac users while signing is off. Revisit once download volume justifies the cost.
- **Windows code-signing is also deferred.** OV certs (~$200/yr) don't earn instant SmartScreen trust until reputation builds; only EV certs (~$400/yr + hardware token) bypass the warning immediately. SmartScreen "More info → Run anyway" is acceptable friction for now, and Scoop users avoid it.
- When enabling either, do it in one PR: add the secrets, flip the relevant `notarize`/`certificateFile` settings in the `build` block, and update the README first-run notes table to remove the workaround rows.

## Unsigned-binary UX (what the README says)

| Channel | First-run experience |
| --- | --- |
| Homebrew cask (macOS) | Just works. Quarantine is stripped by `brew`. |
| Direct `.dmg` (macOS) | Gatekeeper blocks on double-click. User must right-click → Open the first time, or run `xattr -d com.apple.quarantine /Applications/Claude\ Context\ Manager.app`. |
| Scoop (Windows) | Just works. |
| Direct `.exe` (Windows) | SmartScreen shows a blue popup. User clicks "More info" → "Run anyway". |
| `.AppImage` / `.deb` (Linux) | `chmod +x` then run, or install the `.deb` with `apt`. No warnings. |

## MCP self-registration & uninstall hooks

- The app writes a user-scope MCP entry to `~/.claude.json` on launch (`src/main/mcp-self-register.ts`). All four install channels strip it on uninstall by invoking `<app> --cleanup-mcp-registration`:
  - **NSIS (.exe)**: `customUnInstall` macro in `build/installer.nsh`, wired via `nsis.include`.
  - **`.deb`**: prerm script `build/linux-before-remove.sh`, wired via `deb.fpm --before-remove`.
  - **Homebrew cask**: `uninstall_preflight` block in the cask heredoc inside `release.yml`.
  - **Scoop**: `pre_uninstall` array in the manifest heredoc inside `release.yml`.
- AppImage and direct `.dmg` drag-to-trash have no hook surface — they leave a stale entry in `~/.claude.json`. Documented in the README; not worth engineering around.
- If you change the cleanup flag name or move the cleanup logic, update all four hook sites in lockstep.

## Things to be careful about

- **`postinstall` builds the bundled MCP server** (`pnpm mcp:build`). It runs naturally during `pnpm install` in CI; the workflow then asserts `out/mcp/index.mjs` exists before packaging. Don't remove the assertion — a missing MCP entry would silently ship a broken app.
- **`asarUnpack: ["out/mcp/**"]`** is required because the MCP server is spawned as a child process. Things spawned can't live inside the asar archive.
- **Mac arch handling**: arm64 + x64 must be built in a single `electron-builder --mac --arm64 --x64` invocation. Splitting them across jobs corrupts `latest-mac.yml` — each `--publish` overwrites the previous, so only one arch ends up listed and `electron-updater` routes the wrong dmg to half the users. The workflow asserts both arches appear in `latest-mac.yml` after build.
- **Auto-update routing on Homebrew**: the cask uses `auto_updates true`. This means `brew upgrade` is a no-op for this cask — updates flow through `electron-updater` instead. Don't switch to `auto_updates false` unless you also remove `electron-updater` initialization, or the two will fight.
- **Tap/bucket bumps are templated heredocs** inside `release.yml`. If you hand-edit the cask or the manifest in their own repos, the next release overwrites your changes. Make structural changes to the heredoc, not the published file.
- **Don't add code-signing config speculatively.** Wiring `notarize: true` or `certificateFile` paths without the matching secrets fails the build in CI.
- **Don't fire releases on every push to `main`.** The workflow is `on: push: tags: v*` for a reason.

## When done changing the pipeline

- Update [docs/state/facts.md](../../docs/state/facts.md) "Distribution" section if anything structural changed (new target, new channel, new secret, signing turned on).
- Update the README install table if first-run UX changed (e.g. signing enabled removes the right-click → Open row).
- Bump the version tag and push it; verify the GitHub Release lists artifacts for all three platforms and that the tap + bucket commits landed.
