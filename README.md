# Agent Mux

A browser-based terminal multiplexer for managing multiple AI agent sessions. Provides a sidebar with session tabs and a full terminal pane powered by xterm.js. Purpose-built for running concurrent Claude Code sessions across different projects.

## Prerequisites

- Node.js 22+ (managed via [mise](https://mise.jdx.dev/))
- pnpm

## Setup

```bash
mise install
pnpm install
```

## Running

```bash
pnpm dev
```

Opens at http://localhost:3000. The client dev server proxies API and WebSocket requests to the backend.

## Configuration

Optional `config.json` in the repo root (gitignored):

```json
{
  "shell": "/bin/zsh",
  "serverPort": 3000,
  "clientPort": 5173
}
```

- `shell` -- path to shell binary. Defaults to `$SHELL` or `/bin/sh`.
- `serverPort` -- server port. Defaults to `3000`.
- `clientPort` -- Vite dev server port. Defaults to `5173`.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + Shift + N` | New session |
| `Ctrl/Cmd + Shift + 1-9` | Switch to tab by number |

Shortcut hints are shown as keycap badges on each tab (1-9) and the "New session" button.

## Notification Dots

Session tabs show colored dots reflecting Claude Code state:

- **Green dot** -- Claude Code is actively working, processing a prompt (background tabs only)
- **Blue dot** -- Claude Code is idle, waiting for user input (background tabs only)
- **Red pulsing dot** -- Claude Code needs permission to proceed (all tabs)

Green and blue dots clear when you switch to the tab. Red dots clear only when Claude resumes output after permission is granted.

### Hook Setup

Notification dots require hooks in `~/.claude/settings.json`. On first launch, agent-mux detects missing hooks and offers to install them automatically via a banner at the top of the page. A backup (`settings.json.bak`) is created before any changes. Without these hooks, the tabs will still work but no notification dots will appear.

## Project Structure

```
agent-mux/
├── server/                        # Express + WebSocket backend
│   └── src/
│       ├── index.ts               # HTTP/WS server, PTY data forwarding
│       ├── config.ts              # Optional config.json loader
│       ├── sessions.ts            # Session state (PTY, scrollback, git branch)
│       ├── routes.ts              # REST API endpoints
│       ├── pty-manager.ts         # node-pty wrapper
│       ├── hooks-setup.ts         # Hook detection and auto-installation
│       └── notification-watcher.ts # Polls /tmp for hook state files
├── client/                        # React + Tailwind + xterm.js frontend
│   └── src/
│       ├── App.tsx                # Root component, session + notification state
│       ├── types.ts               # Session, NotificationState types
│       ├── terminal-config.ts     # xterm theme + UI colors
│       ├── hooks/
│       │   └── useSession.ts      # WebSocket + xterm lifecycle per tab
│       └── components/
│           ├── Sidebar.tsx        # Tab list + new session button
│           ├── TabItem.tsx        # Single tab with notification dot
│           ├── TerminalPane.tsx   # xterm.js wrapper
│           ├── DirectoryPicker.tsx # Modal with path autocomplete
│           └── HooksBanner.tsx    # Hook setup warning banner
```
