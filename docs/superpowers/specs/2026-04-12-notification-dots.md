# Agent Mux — Notification Dots

**Date:** 2026-04-12
**Status:** Implemented
**Type:** Feature (server + client)

## Purpose

Adds notification dots to session tabs in the sidebar so users can see when a background Claude Code session needs attention — without manually clicking through every tab.

Two dot types:
- **Blue** — Claude Code is idle, waiting for user input
- **Red (pulsing)** — Claude Code needs permission to proceed

## Architecture

```
Claude Code hook fires (idle_prompt or permission_prompt)
  |
  v
Writes state file to /tmp/agent-mux-<PID>.state
  content: "<event_type> <directory>"
  |
  v
Server notification-watcher (polls /tmp every 500ms)
  |  reads + parses state files
  |  matches to session by directory path
  |  deletes processed files
  |
  v
WebSocket push: { type: 'notification', sessionId, state }
  |  sent over the session's existing WS connection
  |
  v
Client updates notificationStates record in App.tsx
  |  Sidebar/TabItem re-render with dot
```

## Hook Configuration

Two separate entries in `~/.claude/settings.json` under `hooks.Notification`, one per event type. Uses hardcoded literal strings (not env vars — `$HOOK_EVENT_NAME` does not exist; hook data comes via stdin JSON, but we avoid parsing it for simplicity):

```json
{
  "matcher": "idle_prompt",
  "hooks": [{
    "type": "command",
    "command": "echo \"idle $(pwd)\" > \"/tmp/agent-mux-$$.state\" # agent-mux"
  }]
},
{
  "matcher": "permission_prompt",
  "hooks": [{
    "type": "command",
    "command": "echo \"permission $(pwd)\" > \"/tmp/agent-mux-$$.state\" # agent-mux"
  }]
}
```

The `# agent-mux` comment acts as a marker for identifying the hook entry. Each hook fire creates a new file (different `$$` subshell PID each time). The server treats these as a message queue: read, process, delete.

## Notification Watcher (`server/src/notification-watcher.ts`)

Polls `/tmp` every 500ms for `agent-mux-*.state` files.

For each file:
1. Read content, parse `<event_type> <directory>` (first word = event, rest = directory)
2. Match to session by normalizing and comparing directory paths
3. If state changed for that session, call `onStateChange(sessionId, state)` callback
4. Delete the file after processing

When multiple files map to the same session, the newest (by mtime) wins.

Maintains internal `Map<string, NotificationState>` keyed by session ID.

**Exports:**
- `startNotificationWatcher(opts)` — begins polling, takes `onStateChange` callback
- `stopNotificationWatcher()` — clears interval
- `clearIfPermission(sessionId)` — clears state only if currently `'permission'`, fires callback with `'none'`

**Stale file cleanup:**
- Files older than 60 seconds with no matching session are deleted regardless of process status
- Files whose originating process (PID from filename) is dead are deleted
- Unparseable files are deleted immediately
- Startup performs a one-time sweep

## Server Wiring (`server/src/index.ts`)

- Watcher starts after `server.listen()`. The `onStateChange` callback sends `{ type: 'notification', sessionId, state }` over the session's active WebSocket connection.
- In the PTY `onData` handler, `clearIfPermission(session.id)` is called on every data event. This auto-clears red dots when Claude resumes producing output after permission is granted. The call is a cheap `Map.get()` + compare — no-op when state is not `'permission'`.
- `stopNotificationWatcher()` is called in `cleanup()` on server shutdown.

## Client State Management (`client/src/App.tsx`)

- `notificationStates: Record<string, NotificationState>` — separate from the sessions array
- `handleNotification(sessionId, state)` — updates the record, passed to each `TerminalPane`
- `handleSelectSession(id)` — sets active ID and clears `'idle'` state for the switched-to tab
- Session close removes the entry from the record

## WebSocket Message Handling (`client/src/hooks/useSession.ts`)

The `onNotification` callback is accepted as a parameter and stored in a ref to avoid stale closures (the effect depends only on `[sessionId]`).

In `ws.onmessage`, data starting with `{` is tentatively parsed as JSON. If it has `type: 'notification'`, the callback fires and the message is not written to the terminal. This follows the same `startsWith('{')` pattern already used server-side for client-to-server resize messages.

## Dot Rendering (`client/src/components/TabItem.tsx`)

**Visibility rules:**
- Blue dot (`idle`): shown only on background tabs (`!isActive`)
- Red dot (`permission`): shown on ALL tabs including active

**Clearing rules:**
- Blue: clears client-side when user switches to that tab
- Red: clears only when server sends `'none'` (triggered by PTY output after permission granted)

**Visual:**
- 8px (`w-2 h-2`) circle with `border-radius: full`
- Glow effect via `boxShadow: 0 0 6px <color>, 0 0 2px <color>`
- Red dot has a CSS `pulse-glow` animation (2s ease-in-out infinite, opacity 1 → 0.5 → 1)
- Positioned inline before the directory path text

**Colors (from `terminal-config.ts` `uiColors`):**
- `notificationIdle: '#81a1c1'` (Nord blue, same as `accent`)
- `notificationPermission: '#bf616a'` (Nord red, same as `dangerText`)

## Session Matching

The hook writes `$(pwd)` which is the working directory of the shell running the hook — typically the directory where Claude Code was launched. The server matches by normalizing paths (stripping trailing slashes) and comparing against `session.directory`.

**Limitation:** Two sessions in the same directory would be ambiguous. Acceptable for POC.

## Files Changed

| File | Change |
|------|--------|
| `~/.claude/settings.json` | Two separate hook entries replacing one combined entry |
| **New:** `server/src/notification-watcher.ts` | Poll /tmp, parse state files, match to sessions |
| `server/src/index.ts` | Wire watcher start/stop, send WS notifications, clear on PTY output |
| `client/src/types.ts` | `NotificationState` type alias |
| `client/src/terminal-config.ts` | Notification dot colors in `uiColors` |
| `client/src/hooks/useSession.ts` | `onNotification` param, JSON message parsing |
| `client/src/App.tsx` | `notificationStates` state, handlers, prop threading |
| `client/src/components/TerminalPane.tsx` | Forward `onNotification` prop |
| `client/src/components/Sidebar.tsx` | Forward `notificationStates` prop |
| `client/src/components/TabItem.tsx` | Dot rendering with glow/pulse |
| `client/src/main.css` | `pulse-glow` keyframe animation |

## Known Limitations

- **Directory matching only.** PID-based matching doesn't work because `$$` in the hook is a subshell PID, not the PTY shell PID. Two sessions in the same directory cannot be distinguished.
- **Polling latency.** Up to 500ms delay before a notification dot appears.
- **Noisy idle dots.** Claude Code may briefly hit idle between tool calls, causing a blue dot to flash. A debounce could be added if this is disruptive in practice.
- **Non-Claude tools.** No notification support — only Claude Code fires the hooks.
