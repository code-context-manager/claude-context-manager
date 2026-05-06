import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { build as esbuild, context as esbuildContext, type BuildOptions } from 'esbuild'
import { resolve } from 'path'
import type { Plugin } from 'vite'

// Builds the MCP stdio server entry alongside the Electron build. Without
// this, `out/mcp/index.mjs` only refreshes via the `mcp:build` script, so a
// dev edit to `src/core/*` silently ships a stale binary to Claude Code.
function mcpBuildPlugin(): Plugin {
  const opts: BuildOptions = {
    entryPoints: [resolve(__dirname, 'src/mcp/index.ts')],
    outfile: resolve(__dirname, 'out/mcp/index.mjs'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    logLevel: 'info',
  }
  let watcher: Awaited<ReturnType<typeof esbuildContext>> | null = null
  return {
    name: 'mcp-build',
    async configResolved(config) {
      const isDev = config.command === 'serve'
      if (isDev) {
        watcher = await esbuildContext(opts)
        await watcher.watch()
        // Restarting the MCP server is up to Claude Code — esbuild only
        // keeps the file on disk current.
        console.log('[mcp] watching src/mcp + src/core (restart Claude Code to pick up changes)')
      } else {
        await esbuild(opts)
      }
    },
    async closeBundle() {
      if (watcher) {
        await watcher.dispose()
        watcher = null
      }
    },
  }
}

export default defineConfig({
  main: {
    plugins: [mcpBuildPlugin()],
    build: {
      outDir: 'out/main',
      lib: {
        entry: resolve(__dirname, 'src/main/index.ts'),
        formats: ['cjs'],
        fileName: () => 'index.js',
      },
      rollupOptions: {
        external: ['electron'],
      },
    },
  },
  preload: {
    build: {
      outDir: 'out/preload',
      lib: {
        entry: resolve(__dirname, 'src/preload/index.ts'),
        formats: ['cjs'],
        fileName: () => 'index.js',
      },
      rollupOptions: {
        external: ['electron'],
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      outDir: resolve(__dirname, 'out/renderer'),
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html'),
      },
    },
    plugins: [react(), tailwindcss()],
  },
})
