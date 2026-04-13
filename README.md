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

## Notification Dots

Session tabs show colored dots reflecting Claude Code state:

- **Green dot** -- Claude Code is actively working, processing a prompt (background tabs only)
- **Blue dot** -- Claude Code is idle, waiting for user input (background tabs only)
- **Red pulsing dot** -- Claude Code needs permission to proceed (all tabs)

Green and blue dots clear when you switch to the tab. Red dots clear only when Claude resumes output after permission is granted.

### Required Hook Setup

Notification dots require hooks in `~/.claude/settings.json`. Add these entries to your `hooks` object.

**macOS / Linux:**

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "echo \"working $(pwd)\" > \"/tmp/agent-mux-$$.state\" # agent-mux"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "echo \"idle $(pwd)\" > \"/tmp/agent-mux-$$.state\" # agent-mux"
          }
        ]
      }
    ],
    "Notification": [
      {
        "matcher": "idle_prompt",
        "hooks": [
          {
            "type": "command",
            "command": "echo \"idle $(pwd)\" > \"/tmp/agent-mux-$$.state\" # agent-mux"
          }
        ]
      },
      {
        "matcher": "permission_prompt",
        "hooks": [
          {
            "type": "command",
            "command": "echo \"permission $(pwd)\" > \"/tmp/agent-mux-$$.state\" # agent-mux"
          }
        ]
      }
    ]
  }
}
```

**Windows (bash shell):**

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "echo \"working $(pwd)\" > \"$TEMP/agent-mux-$$.state\" # agent-mux"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "echo \"idle $(pwd)\" > \"$TEMP/agent-mux-$$.state\" # agent-mux"
          }
        ]
      }
    ],
    "Notification": [
      {
        "matcher": "idle_prompt",
        "hooks": [
          {
            "type": "command",
            "command": "echo \"idle $(pwd)\" > \"$TEMP/agent-mux-$$.state\" # agent-mux"
          }
        ]
      },
      {
        "matcher": "permission_prompt",
        "hooks": [
          {
            "type": "command",
            "command": "echo \"permission $(pwd)\" > \"$TEMP/agent-mux-$$.state\" # agent-mux"
          }
        ]
      }
    ]
  }
}
```

If you already have other entries in these hook arrays, append the agent-mux entries alongside them. The `# agent-mux` comment is a marker -- do not remove it.

Without these hooks, the tabs will still work but no notification dots will appear. The `UserPromptSubmit` and `Stop` hooks are optional -- they enable the green "working" dot. The `Notification` hooks are needed for blue idle and red permission dots.

## Project Structure

```
agent-mux/
├── server/                 # Express + WebSocket backend
│   └── src/
│       ├── index.ts              # HTTP/WS server, PTY data forwarding
│       ├── config.ts             # Optional config.json loader
│       ├── sessions.ts           # Session state (PTY, scrollback, git branch)
│       ├── routes.ts             # REST API endpoints
│       ├── pty-manager.ts        # node-pty wrapper
│       └── notification-watcher.ts # Polls /tmp for hook state files
├── client/                 # React + Tailwind + xterm.js frontend
│   └── src/
│       ├── App.tsx               # Root component, session + notification state
│       ├── types.ts              # Session, NotificationState types
│       ├── terminal-config.ts    # xterm theme + UI colors
│       ├── hooks/
│       │   └── useSession.ts     # WebSocket + xterm lifecycle per tab
│       └── components/
│           ├── Sidebar.tsx       # Tab list + new session button
│           ├── TabItem.tsx       # Single tab with notification dot
│           ├── TerminalPane.tsx  # xterm.js wrapper
│           └── DirectoryPicker.tsx # Modal with path autocomplete
```
