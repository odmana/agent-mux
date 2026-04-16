# Playbooks Feature Design

## Overview

Playbooks are user-defined collections of commands that run in parallel within a tab. A typical use case is running a dev server and client simultaneously. Each tab can have one playbook selected and running at a time.

## Config Schema

Playbooks are defined in `config.json` as an optional `playbooks` array:

```json
{
  "playbooks": [
    {
      "name": "Full Stack Dev",
      "commands": [
        { "label": "API", "command": "cd api && npm run dev" },
        { "label": "Client", "command": "cd client && npm run dev" }
      ]
    }
  ]
}
```

- `playbooks` — optional array. If absent or empty, the playbook feature is effectively hidden (shortcut does nothing).
- Each playbook has a `name` (string, unique) and `commands` (non-empty array).
- Each command has a `label` (string, displayed in UI) and `command` (string, shell command to execute).
- Commands execute from the session's working directory (the tab's `directory`).
- Validated with valibot on config load, consistent with existing config validation.

## Server-Side Architecture

### Playbook Manager (`server/src/playbook-manager.ts`)

A new module that manages playbook execution per session.

**API:**

- `startPlaybook(sessionId, playbook, cwd)` — Spawns all commands using concurrently's programmatic API from the session's working directory. Subscribes to each command's output and close events. If a playbook is already running for the session, it is stopped first.
- `stopPlaybook(sessionId)` — Kills all running processes for the session's playbook.
- `getPlaybookState(sessionId)` — Returns current state: selected playbook name, per-command status (running/exited/errored), log buffer contents.

**Execution:**

- Uses `concurrently(commands, { killOthers: ['failure'] })` for fail-fast behavior on error exits.
- Healthy exits (code 0) let other commands continue running.
- Error exits (non-zero) trigger termination of all remaining commands.

**One playbook per session constraint:** A session can only have one playbook running at a time. Selecting a new playbook while one is running auto-stops the current playbook before starting the new one.

### Log Buffer

- Per-session, capped at 100KB (matching the existing scrollback limit).
- Each entry is structured: `{ source: string, text: string, timestamp: number }`.
- When the buffer exceeds the cap, oldest entries are trimmed.
- Buffer is cleared when a new playbook is started.

### WebSocket Messages

Playbook events flow over the existing session WebSocket connection (`/ws/:sessionId`), adding new message types:

**Server to Client:**

- `{ type: "playbook:output", source: "API", text: "listening on :3000\n" }` — per-command output line.
- `{ type: "playbook:status", commands: [{ label: "API", status: "running" }, { label: "Client", status: "exited", code: 0 }] }` — broadcast whenever a command's status changes.
- `{ type: "playbook:stopped" }` — all commands have stopped (either manually or via fail-fast).

**Client to Server:**

- `{ type: "playbook:start", playbookName: "Full Stack Dev" }` — start a playbook. If one is already running, it is stopped first.
- `{ type: "playbook:stop" }` — stop all running commands.

### Session Cleanup

- When a session is deleted, any running playbook is stopped automatically.
- Same on app shutdown — all playbooks are stopped.

## Persistence

The selected playbook name per session is persisted in `state.json`:

```json
{
  "sessions": [
    { "directory": "~/projects/my-app", "playbook": "Full Stack Dev" },
    { "directory": "~/projects/other" }
  ],
  "sidebarWidth": 250
}
```

- Only the playbook **name** is persisted, not the running state.
- On app restart, the playbook is pre-selected in the UI but not auto-started. The user presses start manually.
- If the persisted playbook name no longer exists in the config, it is silently cleared.

## Frontend Architecture

### Keyboard Shortcut

- `Ctrl/Cmd + \` (without Shift) toggles the playbook view for the active tab.
- If no playbook is selected for the current tab, the shortcut opens the playbook selector.
- If the playbook view is already showing, the shortcut hides it and returns to the terminal.
- Pressing again brings it back with state intact.
- Registered in `App.tsx` alongside existing shortcuts.

### Playbook Selector

A fuzzy search modal, similar to the existing `DirectoryPicker`:

- Shown when the shortcut is pressed with no playbook selected, or when clicking the playbook name in the header bar.
- Lists all playbooks from config, filtered by typed query using fuzzy matching on the client (the playbook list is small and already loaded from config on startup, no server round-trip needed).
- Selecting a playbook sets it for the current session and persists to `state.json`.
- Selecting a different playbook while one is running stops the current one first.
- Escape key closes the selector without changing the selection.

### Playbook View (`PlaybookView.tsx`)

Slides in over the terminal pane content using the same slide animation as the auxiliary shell (CSS transform translate-x).

**Layout:**

- **Header bar**: Playbook name (clickable to reopen selector) + start/stop button on the right.
- **Filter toggles**: Row of toggle buttons below the header, one per command label. All active by default. Toggling hides/shows that command's logs in the stream (visual filtering only — buffer is unaffected).
- **Log stream**: Scrollable container showing log entries.

**Log Stream Details:**

- Each line prefixed with `[Label]`, styled with a distinct color per command for visual separation.
- ANSI color codes in command output are rendered as styled HTML using `ansi-to-html`.
- Monospace font consistent with the rest of the app.
- Auto-scrolls to bottom when new output arrives, unless the user has scrolled up.
- A "jump to tail" button appears when the user is scrolled away from the bottom.
- Clicking "jump to tail" scrolls to the bottom and re-enables auto-scroll.

### State Management

New state in `App.tsx`:

- `playbooks: PlaybookConfig[]` — loaded from `/api/config` on startup.
- Per-session playbook state (selected playbook, command statuses, log buffer, filter toggles, view visibility) managed via the existing ref + state pattern.
- WebSocket messages update the per-session playbook state.

### Toggle Animation

The playbook view slides in and out using the same CSS transform animation as the auxiliary shell (`translate-x-full`), maintaining visual consistency across the app.

## Dependencies

**New server dependency:**
- `concurrently` — programmatic API for parallel command execution.

**New client dependency:**
- `ansi-to-html` — converts ANSI escape codes to styled HTML for log rendering.

## New Files

- `server/src/playbook-manager.ts` — playbook execution lifecycle and log buffer management.
- `client/src/components/PlaybookView.tsx` — playbook UI (header, filters, log stream).
- `client/src/components/PlaybookSelector.tsx` — fuzzy search modal for picking a playbook.

## Modified Files

- `server/src/config.ts` — add `playbooks` to config schema and loading.
- `server/src/server.ts` — handle new WebSocket message types for playbook start/stop/output.
- `server/src/sessions.ts` — stop playbook on session deletion.
- `server/src/state.ts` — extend state schema with per-session `playbook` field.
- `server/src/routes.ts` — expose playbooks list via `/api/config` response.
- `client/src/App.tsx` — add `Ctrl/Cmd + \` shortcut, playbook state, pass props to components.
- `client/src/components/TerminalPane.tsx` — integrate PlaybookView with slide animation.
- `client/src/types.ts` — add playbook-related type definitions.
