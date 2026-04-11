# Agent Mux — Terminal Multiplexer for AI Agents

**Date:** 2026-04-11
**Status:** POC
**Type:** CLI tool (Node.js, distributed via npm)

## Purpose

A terminal multiplexer that manages multiple AI agents (Claude Code or other CLI tools) running in different directories. Provides a tabbed sidebar with notification indicators and a native shell experience in the main pane. Think tmux but purpose-built for managing concurrent agent sessions.

## Architecture

Three layers:

```
┌─────────────────────────────────────────────┐
│  Renderer                                   │
│  Draws sidebar + active terminal pane       │
│  Raw ANSI escape sequences to stdout        │
├─────────────────────────────────────────────┤
│  Session Manager                            │
│  Manages tabs, routes input, tracks state   │
├─────────────────────────────────────────────┤
│  PTY Layer                                  │
│  node-pty spawns + xterm-headless parses    │
└─────────────────────────────────────────────┘
```

### PTY Layer

Each tab gets a `node-pty` instance spawning a shell in a chosen directory. Output feeds into a paired `@xterm/headless` Terminal instance that maintains a cell buffer. `@xterm/addon-serialize` converts the buffer to ANSI strings for rendering.

Exposes: `write(data)`, `resize(cols, rows)`, `kill()`.

### Session Manager

Holds an array of sessions:

```ts
interface Session {
  id: string;
  pty: IPty;
  terminal: Terminal; // xterm-headless
  directory: string;
  branch: string;
  notificationState: 'none' | 'idle' | 'permission';
}
```

Responsibilities:
- Add/remove/switch tabs
- Track active tab index
- Read git branch name from each session's directory
- Watch for notification triggers via Claude Code hooks (file-based)
- Clear notification state when user switches to a tab
- Clear notification state when a background tab produces PTY output after being idle

### Renderer

No TUI framework. Thin custom renderer using raw ANSI escape sequences.

- Enters alternate screen buffer on start, restores on exit
- Two regions: sidebar (fixed width ~30 cols) and main pane (remaining width)
- **Sidebar:** tab list showing directory name, git branch, notification dot (blue for idle, red for permission required). Highlights active tab. "+" row at bottom.
- **Main pane:** writes serialized xterm-headless buffer, clipped to pane dimensions
- Redraws on: tab switch, PTY output (debounced), terminal resize, notification state change

### Input Router

Stdin in raw mode. Three input contexts:

| Context | Mouse | Keyboard |
|---------|-------|----------|
| **Navigation** (sidebar focused) | Click tab = switch, click "+" = new tab | Arrow keys navigate, Enter = switch + focus terminal |
| **Terminal** (main pane focused) | Clicks forwarded to PTY | All keystrokes forwarded to PTY |
| **Directory picker** (overlay) | Click suggestion = select it | Type to filter, Tab = accept suggestion, Enter = confirm, Esc = cancel |

**Prefix key:** `Ctrl+A` (tmux-style)
- From terminal mode: `Ctrl+A` then navigation key enters navigation mode
- Clicking sidebar from terminal mode switches to navigation
- Clicking main pane from navigation switches to terminal mode

**Mouse tracking:** SGR mouse mode (`\x1b[?1006h`) for click coordinates. Mouse events forwarded to PTY when in terminal mode (for vim, htop, Claude Code UI support).

### Directory Picker

Triggered by pressing "+" or `Ctrl+A, n`. Renders an inline text input overlaid on the main pane.

- As the user types a path, reads the filesystem and displays matching directories below the input
- Tab key accepts the current top suggestion
- Enter confirms the path and spawns a new tab with a shell in that directory
- Esc cancels and returns to previous state

### Notification System

Integrates with Claude Code's hooks system. On first run, agent-mux auto-configures the hook:

1. Read `~/.claude/settings.json` (create if missing)
2. Parse the existing `hooks.Notification` array (or create it)
3. Check if an agent-mux hook entry already exists (identified by a marker in the command string)
4. If not present, append the entry to the array and write back

The hook entry appended:

```json
{
  "matcher": "idle_prompt|permission_prompt",
  "hooks": [{
    "type": "command",
    "command": "echo $HOOK_EVENT_NAME > /tmp/agent-mux-$SESSION_ID.state # agent-mux"
  }]
}
```

The `# agent-mux` comment at the end acts as a marker for identifying and removing the hook later. Existing user hooks in the `Notification` array are left untouched.

The session manager watches `/tmp/agent-mux-*.state` using `fs.watch()`. Matching a state file to a tab works by PTY ancestry: agent-mux knows each tab's PTY pid, and Claude Code runs as a child process of that PTY's shell. When a state file appears, agent-mux checks which tab's PTY is an ancestor of the Claude Code process that wrote it (via the PID in the state file). As a simpler fallback for the POC, the hook command can include the shell's CWD or PTY pid, and agent-mux matches on directory path.

The sidebar renders a colored dot: blue for `idle_prompt` (waiting for user input), red for `permission_prompt` (needs permission to proceed). Blue dots only appear on background tabs — if the tab is active, the user can already see Claude is waiting. Red dots appear on all tabs (including the active tab) and persist until resolved — they clear only when the tab produces PTY output, indicating the permission was granted and Claude has resumed work. Switching to a tab clears blue dots but not red ones.

Non-Claude tools: no notification support in POC.

## Tech Stack

- **Runtime:** Node.js (managed via `mise`)
- **Package manager:** pnpm
- **Language:** TypeScript
- **Dependencies:**
  - `node-pty` — PTY spawning
  - `@xterm/headless` — terminal emulation (cell buffer)
  - `@xterm/addon-serialize` — buffer to ANSI string serialization
- **Dev dependencies:**
  - `typescript`
  - `tsx` — run TypeScript directly during development

## Project Structure

```
agent-mux/
├── .mise.toml            # node version
├── package.json          # type: module, bin: agent-mux
├── tsconfig.json
├── src/
│   ├── index.ts          # entry point, parse args, bootstrap
│   ├── pty-manager.ts    # node-pty + xterm-headless per session
│   ├── session-manager.ts # tab state, notifications, git branch
│   ├── renderer.ts       # ANSI rendering (sidebar + main pane)
│   ├── input.ts          # raw mode, prefix keys, mouse tracking
│   └── directory-picker.ts # inline autocomplete overlay
```

## User Flow

1. User runs `agent-mux` (or `npx agent-mux`)
2. App launches in alternate screen buffer with an empty sidebar and a prompt to add a tab
3. User presses "+" or `Ctrl+A, n`
4. Directory picker overlay appears. User types a path with autocomplete.
5. User confirms with Enter. A new tab appears in the sidebar, shell spawns in that directory.
6. User is in terminal mode — they type `claude` or any command.
7. User presses `Ctrl+A` to enter navigation mode, adds more tabs.
8. When Claude Code in a background tab finishes and waits for input, a blue dot appears on that tab.
9. User clicks or navigates to the tab to resume interaction.
10. `Ctrl+C` / `Ctrl+D` in the shell exits the shell. Closing the last tab exits agent-mux.

## POC Scope

**In scope:**
- Sidebar with tab list (keyboard navigable + mouse clickable)
- Main pane rendering PTY output via xterm-headless + addon-serialize
- New tab creation with directory autocomplete
- Input routing (prefix key + mouse for mode switching)
- Terminal resize handling (SIGWINCH)
- Claude Code notification dots via hooks
- Clean exit (restore terminal state, kill all PTYs)

**Out of scope (future):**
- Windows testing (target macOS/Linux first)
- Config file for predefined projects
- Tab reordering / drag
- Split panes
- Session persistence / resume
- Single binary compilation
