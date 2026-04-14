# Electron Desktop App

## Context

agent-mux is a browser-based terminal multiplexer for managing multiple Claude Code sessions. It currently runs as an Express server (node-pty + WebSocket) with a React SPA client, accessed via `http://localhost:{port}`. The goal is to wrap this into a standalone Electron desktop app while keeping the existing browser-based dev workflow intact.

**Approach**: Embed the Express server in Electron's main process. The BrowserWindow loads `http://localhost:{port}`, so the client's relative URL construction (`window.location.host`) works without any client code changes. This is the minimal-friction path -- no IPC bridge, no protocol handlers, no client modifications.

---

## Step 1: Refactor server for embeddability

Extract a `startServer()` function from `server/src/index.ts` so both the standalone CLI and Electron can start the server programmatically.

### 1a. Create `server/src/server.ts`

New file exporting:

```ts
export interface StartServerOptions {
  configPath?: string;
  clientDistPath?: string;
}

export interface ServerInstance {
  server: Server;
  port: number;
  cleanup: () => void;
}

export function startServer(options?: StartServerOptions): Promise<ServerInstance>;
```

Move lines 17-156 of `index.ts` into this function. Key changes:

- Accept optional `configPath` -> pass to `loadConfig(configPath)`
- Accept optional `clientDistPath` -> override the default `../../client/dist` resolution
- Return a promise that resolves with `{ server, port, cleanup }` once listening
- The `cleanup()` function calls `stopNotificationWatcher()`, `killAllSessions()`, `server.close()`

### 1b. Slim down `server/src/index.ts`

Replace with a thin wrapper:

```ts
import { startServer } from './server.js';
const { cleanup } = await startServer();
// signal handlers call cleanup() then process.exit(0)
```

### 1c. Add `configPath` parameter to `loadConfig()` in `server/src/config.ts`

```ts
export function loadConfig(configPath?: string): Config {
  // use configPath ?? resolve(import.meta.dirname, '../../config.json')
}
```

### 1d. Add exports field to `server/package.json`

```json
"exports": {
  "./server": "./dist/server.js"
}
```

### Verify

Run `pnpm dev` -- everything should work identically. Run `pnpm -C server test`.

---

## Step 2: Create the `electron/` workspace package

### 2a. Update `pnpm-workspace.yaml`

```yaml
packages:
  - 'server'
  - 'client'
  - 'electron'
```

### 2b. Create `electron/package.json`

Key points:

- `"main": "dist/bundle.mjs"` -- esbuild-bundled entry point
- Dependencies: `agent-mux-server: workspace:*`, `node-pty: 1.1.0`
- Dev dependencies: `electron`, `@electron/rebuild`, `electron-builder`, `esbuild`, `typescript`, `@types/node`
- All exact versions (no `^`/`~`)
- `"scripts"`: `dev`, `build` (tsc), `bundle` (esbuild), `dist` (electron-builder)
- `"build"` field for electron-builder config:
  - `npmRebuild: false` -- skip native rebuild (Node 22 prebuilds are ABI-compatible with Electron 41)
  - `asarUnpack: ["node_modules/node-pty/**"]` -- native addons can't load from asar
  - `extraResources: [{ from: "../client/dist", to: "client-dist" }]`
  - All platform targets: `dir` (unpacked directory with exe)
  - `signAndEditExecutable: false` for Windows (avoids code signing requirement)

### 2c. esbuild bundling

The server and all its JS dependencies (express, ws, etc.) are bundled into a single `bundle.mjs` file using esbuild. Only `node-pty` (native addon) and `electron` are external. This avoids pnpm symlink issues where electron-builder can't resolve transitive dependencies.

```
esbuild dist/main.js --bundle --platform=node --format=esm \
  --outfile=dist/bundle.mjs --external:node-pty --external:electron \
  --banner:js="import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);"
```

The banner adds a `require` shim so CJS dependencies (like Express) work inside the ESM bundle.

### 2d. Create `electron/src/main.ts`

The main process entry point:

1. **Single instance lock** -- `app.requestSingleInstanceLock()`, refocus window on second launch
2. **Start server** -- import `startServer` from `agent-mux-server/server`, pass config/dist paths
3. **Create BrowserWindow** -- load `http://localhost:{port}`, Nord-themed background (`#2e3440`), contextIsolation enabled
4. **Quit confirmation** -- `will-prevent-unload` handler shows native dialog when sessions are open
5. **Lifecycle** -- closing the window calls `cleanup()` and `process.exit(0)`

Path resolution:

- **Dev**: config from `../../config.json`, client dist from `../../client/dist`
- **Packaged**: config from `app.getPath('userData')/config.json`, client dist from `process.resourcesPath/client-dist`

---

## Step 3: Wire up build scripts and config

### 3a. Root `package.json` changes

Add scripts:

```json
"dev": "pnpm -C client build && pnpm -C server build && pnpm -C electron dev",
"dev:browser": "pnpm --parallel -r --filter=!agent-mux-electron run dev",
"build:electron": "pnpm -C client build && pnpm -C server build && pnpm -C electron build && pnpm -C electron bundle",
"dist": "pnpm run build:electron && pnpm -C electron dist"
```

Add `electron`, `electron-winstaller`, `esbuild` to `pnpm.onlyBuiltDependencies`.

### 3b. `.gitignore`

Add `electron/release/` (electron-builder output). `electron/dist/` is already covered by the existing `dist/` pattern.

---

## Step 4: Handle node-pty native addon

- `npmRebuild: false` in electron-builder config skips recompilation. This works because Electron 41 embeds Node 22, matching the system Node ABI.
- If Electron is upgraded to a version with a different Node ABI, Python must be installed for `node-gyp` to recompile node-pty. Install via `mise use python@3` and remove `npmRebuild: false`.
- `electron-builder` config uses `asarUnpack` to extract node-pty from the asar archive at package time.

---

## Files Summary

**New files:**
| File | Purpose |
|------|---------|
| `server/src/server.ts` | Extracted `startServer()` function |
| `electron/package.json` | Electron package config + electron-builder config |
| `electron/tsconfig.json` | TypeScript config for main process |
| `electron/src/main.ts` | Electron main process (window, lifecycle) |
| `electron/build/icon.ico` | Windows app icon (placeholder) |
| `electron/build/icon.png` | Linux app icon (placeholder) |

**Modified files:**
| File | Change |
|------|--------|
| `server/src/index.ts` | Slim down to thin wrapper calling `startServer()` |
| `server/src/config.ts` | Add optional `configPath` parameter to `loadConfig()` |
| `server/tsconfig.json` | Add `declaration: true` for type exports |
| `server/package.json` | Add `exports` field |
| `pnpm-workspace.yaml` | Add `electron` workspace |
| `package.json` (root) | Add electron scripts, update `onlyBuiltDependencies` |
| `.gitignore` | Add `electron/release/` |

**Untouched** -- all client code (React, Vite, xterm.js, components, hooks, CSS).

---

## Verification

1. **Existing browser mode still works**: `pnpm dev:browser` starts server + client dev server
2. **Server tests pass**: `pnpm -C server test`
3. **Electron dev mode**: `pnpm dev` opens the app in an Electron window with working terminals
4. **PTY works in Electron**: Create a session, type commands, verify output streams correctly
5. **Notifications work**: Notification dots appear when Claude Code hooks fire
6. **Quit confirmation**: Closing with active sessions shows native dialog
7. **Package build**: `pnpm dist` produces executable in `electron/release/win-unpacked/`
