# Agent Mux (Web) — Browser-Based Terminal Multiplexer for AI Agents

**Date:** 2026-04-11
**Status:** POC
**Type:** Web app (Node.js backend + React frontend)

## Purpose

A browser-based terminal multiplexer that manages multiple AI agent sessions (Claude Code or other CLI tools) running in different directories. Provides a sidebar with session tabs and a full terminal pane powered by xterm.js. User launches a local server and opens the UI in their browser.

Replaces the terminal-native approach (raw ANSI rendering) with a web UI that avoids the rendering fragility, mouse event leakage, and PTY permission issues of the original design. The frontend can later be wrapped in a Tauri app with minimal changes.

## Architecture

Two packages in a monorepo:

```
┌─────────────────────────────────────────────┐
│  Browser (React + Tailwind + xterm.js)      │
│  Sidebar component + Terminal pane component│
│  One xterm.js instance per tab              │
│  One WebSocket connection per tab           │
├─────────────────────────────────────────────┤
│  WebSocket (bidirectional PTY data)         │
│  REST API (session lifecycle + directories) │
├─────────────────────────────────────────────┤
│  Node.js Server (Express + ws)              │
│  Serves built client assets                 │
│  Spawns node-pty per session                │
└─────────────────────────────────────────────┘
```

### Server

Express serves the built client and exposes:

**REST API:**

- `POST /api/sessions` — create session. Body: `{ directory: string }`. Server spawns a `node-pty` shell in that directory, reads the git branch, returns `{ id: string, directory: string, branch: string }`.
- `GET /api/sessions` — list all active sessions.
- `DELETE /api/sessions/:id` — kill PTY, close WebSocket, remove session.
- `GET /api/directories?prefix=<path>` — return matching subdirectories for autocomplete. Expands `~` to home directory. Filters hidden directories.

**WebSocket:**

- `/ws/:sessionId` — opened by the client after session creation. Bidirectional binary frames: client sends keystrokes, server sends PTY output. Also accepts JSON messages for resize: `{ type: "resize", cols: number, rows: number }`.

**PTY Management:**

Each session holds a `node-pty` instance. The shell to spawn is determined by (in priority order):

1. `shell` field in `config.json` (if present)
2. `process.env.SHELL` (macOS/Linux)
3. `powershell.exe` (Windows)

Environment passes through `TERM=xterm-256color`.

**Configuration:**

On startup, the server reads `config.json` from the working directory (if it exists). The file is optional — all fields have defaults.

```json
{
  "shell": "/bin/zsh",
  "port": 3000
}
```

- `shell` — path to shell binary. Defaults to `$SHELL` or `powershell.exe`.
- `port` — server port. Defaults to `3000`.

**Cleanup:**

On server shutdown (SIGINT, SIGTERM, SIGHUP, uncaught exception), iterate all sessions and kill every PTY before exiting.

### Client

React + Tailwind + xterm.js, built with Vite.

**Layout:** Two regions — a fixed-width sidebar on the left and a terminal pane filling the remaining space.

**Sidebar:** Displays the list of session tabs. Each tab shows:

- Directory name (basename of path)
- Git branch
- Close button (×)

Active tab is visually highlighted. A "+ New tab" button is pinned at the bottom.

**Terminal pane:** Each tab has its own xterm.js `Terminal` instance mounted in a container div. On tab switch, the active container is shown and others are hidden. All instances stay mounted — background tabs continue receiving PTY output over their WebSocket connections.

**Design style:** Dark theme with subtle glassmorphism on the sidebar (rgba backgrounds, soft borders). Notification dots use glow effects. 10px border radius on interactive elements. Sans-serif for the sidebar (Inter/system), monospace for the terminal (JetBrains Mono/system).

### Communication

**Opening a new tab:**

1. User clicks "+ New tab" → `DirectoryPicker` modal opens
2. User types a path → client calls `GET /api/directories?prefix=...` for autocomplete suggestions
3. User confirms → client calls `POST /api/sessions { directory }`.
4. Server spawns PTY, returns session metadata
5. Client opens WebSocket to `/ws/:id`, creates xterm.js instance, attaches them
6. Client sends `{ type: "resize", cols, rows }` over WebSocket

**Typing in a terminal:**

1. xterm.js `onData` → send keystroke bytes over WebSocket
2. Server receives → writes to `node-pty`
3. PTY output → server sends over WebSocket
4. Client receives → writes to xterm.js

**Switching tabs:**

1. Click tab → React state update (`activeSessionId`)
2. Show active xterm container, hide others
3. Call `terminal.focus()` and `fitAddon.fit()` on the active terminal

**Closing a tab:**

1. Click × → `DELETE /api/sessions/:id`
2. Server kills PTY, WebSocket closes
3. Client disposes xterm.js instance, removes tab

**Terminal resize:**

1. Browser window resizes → xterm.js fit addon recalculates dimensions
2. Client sends `{ type: "resize", cols, rows }` over WebSocket
3. Server calls `pty.resize(cols, rows)`

## Tech Stack

**Server:**

- Node.js (managed via `mise`)
- TypeScript
- `express` — HTTP server, static file serving
- `ws` — WebSocket server
- `node-pty` — PTY spawning
- `tsx` — dev runner

**Client:**

- React
- Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- `@xterm/xterm` — terminal emulation in the browser
- `@xterm/addon-fit` — auto-resize terminal to container
- Vite — build tool and dev server

## Project Structure

```
agent-mux/
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts          # express + ws bootstrap, serves client
│       ├── pty-manager.ts    # node-pty spawn/resize/kill per session
│       ├── sessions.ts       # session state map, CRUD operations
│       └── routes.ts         # REST endpoints + directory listing
├── client/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx          # React entry point
│       ├── App.tsx           # layout: sidebar + terminal pane
│       ├── components/
│       │   ├── Sidebar.tsx       # tab list + new tab button
│       │   ├── TabItem.tsx       # single tab entry
│       │   ├── TerminalPane.tsx  # xterm.js wrapper per session
│       │   └── DirectoryPicker.tsx # modal with path autocomplete
│       ├── hooks/
│       │   └── useSession.ts # WebSocket + xterm lifecycle per tab
│       └── types.ts          # shared types (Session, etc.)
```

## User Flow

1. User runs `agent-mux` (starts the server)
2. Server prints `Listening on http://localhost:3000`
3. User opens URL in browser
4. Empty sidebar with "+ New tab" button
5. User clicks "+ New tab" → directory picker modal
6. User types a path with autocomplete, confirms
7. New tab appears in sidebar, terminal pane shows a shell in that directory
8. User types commands (e.g. `claude`)
9. User adds more tabs, clicks between them to switch
10. Click × on a tab to close it
11. Ctrl+C in the server terminal (or closing all tabs) shuts everything down

## POC Scope

**In scope:**

- Sidebar with session tab list (click to switch, × to close)
- Terminal pane with xterm.js per tab (stays mounted when backgrounded)
- New tab creation with directory autocomplete modal
- REST API for session lifecycle + directory autocomplete
- WebSocket per session for bidirectional PTY I/O
- Git branch display per tab
- Terminal resize handling (fit addon → WebSocket resize message)
- Cross-platform shell selection (zsh/bash on macOS/Linux, PowerShell on Windows)
- Server cleanup on exit (kill all PTYs)

**Out of scope (future):**

- Notification system (Claude Code hooks, blue/red dots)
- Tauri desktop app wrapping
- Config file for predefined projects
- Tab reordering / drag
- Split panes
- Session persistence / resume
