# Taskbar Badge for Permission State

## Context

Agent Mux runs Claude CLI agents in terminal tabs. When an agent needs permission (e.g., tool approval), the tab shows a pulsing red dot. However, if the window is minimized or behind other windows, the user has no way to know a tab needs attention. This spec adds an OS taskbar badge overlay so the user can see at a glance that action is required.

## Trigger

Badge appears when **any** session enters the `permission` notification state. Badge clears when **no** sessions are in `permission` state. The `idle` and `working` states do not trigger the badge.

## Architecture

The server process already detects notification state changes via file polling in `notification-watcher.ts` and currently pushes them to the renderer over WebSocket. Since the server runs in-process with Electron's main process (started via `startServer()` in `main.ts`), we add a callback on `ServerInstance` — no IPC or preload script needed.

```
notification-watcher (polls tmpdir every 500ms)
  → onStateChange callback in server.ts
    → (1) WebSocket push to renderer (existing, for in-app tab dots)
    → (2) external handler registered by main.ts (NEW, for OS badge)
        → setOverlayIcon / dock.setBadge / setBadgeCount
```

## Changes

### 1. `server/src/notification-watcher.ts` — Add `clearSessionState`

Add a new exported function `clearSessionState(sessionId: string)` that removes the session from the internal `states` map and fires the `onStateChange` callback with state `'none'`. This ensures the badge updates when a session is deleted while it has a `permission` state.

### 2. `server/src/server.ts` — Expose notification callback on `ServerInstance`

- Add `onNotificationStateChange` method to the `ServerInstance` interface. It registers an external handler that gets called alongside the existing WebSocket push whenever `onStateChange` fires.
- Re-export the `NotificationState` type so the Electron package can import it.

### 3. `server/src/routes.ts` — Clear state on session deletion

In the `DELETE /api/sessions/:id` handler, call `clearSessionState(req.params.id)` before `deleteSession()` so the badge updates if the deleted session was in `permission` state.

### 4. `electron/src/main.ts` — Badge management

- Maintain a `Set<string>` of session IDs currently in `permission` state.
- Register a handler via `serverInstance.onNotificationStateChange()`:
  - If state is `permission`: add session ID to set.
  - If state is anything else: remove session ID from set.
  - Call `updateBadge(set.size)`.
- `updateBadge(count)` uses platform-specific APIs:
  - **Windows**: `mainWindow.setOverlayIcon(icon, "Permission needed")` when count > 0, `setOverlayIcon(null, "")` when 0. Icon is a 16x16 red circle created from a base64 data URL via `nativeImage.createFromDataURL()`.
  - **macOS**: `app.dock.setBadge(String(count))` when count > 0, `app.dock.setBadge("")` when 0.
  - **Linux**: `app.setBadgeCount(count)` (works on Unity/KDE, silently no-ops elsewhere).

## Critical files

- `server/src/notification-watcher.ts` — state tracking + new `clearSessionState`
- `server/src/server.ts` — `ServerInstance` interface + callback registration
- `server/src/routes.ts` — session deletion handler
- `electron/src/main.ts` — badge management logic

## Verification

1. Start the Electron app, open a terminal tab, launch a Claude agent
2. Trigger a permission prompt (e.g., a tool that requires approval)
3. Minimize or alt-tab away from Agent Mux
4. Confirm the taskbar icon shows a red badge overlay (Windows) or dock badge (macOS)
5. Switch back and approve the permission
6. Confirm the badge clears
7. Open two tabs, trigger permissions in both, approve one — confirm badge persists
8. Delete a session that has a pending permission — confirm badge updates
