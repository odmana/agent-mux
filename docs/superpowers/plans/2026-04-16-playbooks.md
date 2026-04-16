# Playbooks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a playbooks feature that lets users define collections of parallel commands in config, select them per tab, and view aggregated log output with filtering.

**Architecture:** Server-side playbook manager uses `concurrently`'s programmatic API to spawn parallel commands per session, streaming structured output over the existing session WebSocket. Client adds a slide-in PlaybookView panel (matching aux shell animation) with fuzzy selector, filter toggles, and an ANSI-rendered log stream.

**Tech Stack:** concurrently (server), ansi-to-html (client), valibot (validation), React + Tailwind (UI)

---

### Task 1: Config Schema — Add Playbooks to Config

**Files:**

- Modify: `server/src/config.ts`
- Test: `server/test/config.test.ts`

- [ ] **Step 1: Write failing tests for playbook config loading**

Add these tests to `server/test/config.test.ts`:

```typescript
it('reads playbooks from config.json', () => {
  writeFileSync(
    configPath,
    JSON.stringify({
      playbooks: [
        {
          name: 'Dev',
          commands: [
            { label: 'API', command: 'npm run api' },
            { label: 'Client', command: 'npm run client' },
          ],
        },
      ],
    }),
  );
  const config = loadConfig();
  expect(config.playbooks).toHaveLength(1);
  expect(config.playbooks![0].name).toBe('Dev');
  expect(config.playbooks![0].commands).toHaveLength(2);
  expect(config.playbooks![0].commands[0]).toEqual({ label: 'API', command: 'npm run api' });
});

it('returns undefined playbooks when not configured', () => {
  writeFileSync(configPath, JSON.stringify({}));
  const config = loadConfig();
  expect(config.playbooks).toBeUndefined();
});

it('ignores invalid playbooks entries', () => {
  writeFileSync(configPath, JSON.stringify({ playbooks: 'not an array' }));
  const config = loadConfig();
  expect(config.playbooks).toBeUndefined();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm -C server test`
Expected: 3 new tests FAIL (playbooks property doesn't exist on Config)

- [ ] **Step 3: Implement playbook config loading**

In `server/src/config.ts`, add the playbook types and update `loadConfig`:

```typescript
// Add after the Config interface (line 12):

export interface PlaybookCommand {
  label: string;
  command: string;
}

export interface PlaybookConfig {
  name: string;
  commands: PlaybookCommand[];
}

// Add to Config interface:
export interface Config {
  shell: string;
  serverPort: number;
  clientPort: number;
  initialCommand?: string;
  auxInitialCommand?: string;
  defaultDirectory?: string;
  playbooks?: PlaybookConfig[];
}

// In loadConfig(), add parsing after the existing fields in the return object:
// After line 38 (defaultDirectory), add playbooks parsing:
playbooks: parsePlaybooks(raw.playbooks),
```

Add the parsing function before `loadConfig`:

```typescript
function parsePlaybooks(raw: unknown): PlaybookConfig[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const valid: PlaybookConfig[] = [];
  for (const entry of raw) {
    if (
      typeof entry === 'object' &&
      entry !== null &&
      typeof entry.name === 'string' &&
      Array.isArray(entry.commands) &&
      entry.commands.length > 0
    ) {
      const commands: PlaybookCommand[] = [];
      for (const cmd of entry.commands) {
        if (
          typeof cmd === 'object' &&
          cmd !== null &&
          typeof cmd.label === 'string' &&
          typeof cmd.command === 'string'
        ) {
          commands.push({ label: cmd.label, command: cmd.command });
        }
      }
      if (commands.length > 0) {
        valid.push({ name: entry.name, commands });
      }
    }
  }
  return valid.length > 0 ? valid : undefined;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -C server test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add server/src/config.ts server/test/config.test.ts
git commit -m "feat(playbooks): add playbook config schema and parsing"
```

---

### Task 2: State Persistence — Add Playbook Selection to State

**Files:**

- Modify: `server/src/state.ts`
- Test: `server/test/state.test.ts` (new)

- [ ] **Step 1: Write failing tests for playbook state persistence**

Create `server/test/state.test.ts`:

```typescript
import { existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, it, expect, afterEach } from 'vitest';

import { loadState, updateState } from '../src/state.js';

describe('state persistence', () => {
  const statePath = resolve(import.meta.dirname, '../../test-state.json');

  afterEach(() => {
    if (existsSync(statePath)) unlinkSync(statePath);
  });

  it('persists playbook per session', () => {
    updateState(statePath, {
      sessions: [{ directory: '/tmp', playbook: 'Dev' }],
    });
    const state = loadState(statePath);
    expect(state.sessions![0].playbook).toBe('Dev');
  });

  it('sessions without playbook omit the field', () => {
    updateState(statePath, {
      sessions: [{ directory: '/tmp' }],
    });
    const state = loadState(statePath);
    expect(state.sessions![0].playbook).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm -C server test`
Expected: FAIL — `playbook` property not in schema

- [ ] **Step 3: Add playbook field to state schema**

In `server/src/state.ts`, update the `AppStateSchema`:

```typescript
export const AppStateSchema = v.object({
  sidebarWidth: v.optional(v.pipe(v.number(), v.minValue(180), v.maxValue(400))),
  sessions: v.optional(
    v.array(v.object({ directory: v.string(), playbook: v.optional(v.string()) })),
  ),
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -C server test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add server/src/state.ts server/test/state.test.ts
git commit -m "feat(playbooks): add playbook selection to persisted state"
```

---

### Task 3: Playbook Manager — Server-Side Execution Engine

**Files:**

- Create: `server/src/playbook-manager.ts`
- Test: `server/test/playbook-manager.test.ts` (new)

- [ ] **Step 1: Install concurrently dependency**

```bash
cd /Users/work/projects/agent-mux && pnpm -C server add concurrently --save-exact
```

- [ ] **Step 2: Write failing tests for playbook manager**

Create `server/test/playbook-manager.test.ts`:

```typescript
import { describe, it, expect, afterEach } from 'vitest';

import {
  startPlaybook,
  stopPlaybook,
  getPlaybookState,
  stopAllPlaybooks,
} from '../src/playbook-manager.js';

describe('playbook-manager', () => {
  afterEach(async () => {
    await stopAllPlaybooks();
  });

  it('starts a playbook and collects output', async () => {
    const logs: { source: string; text: string }[] = [];
    await startPlaybook(
      'session-1',
      {
        name: 'Test',
        commands: [{ label: 'Echo', command: 'echo hello' }],
      },
      '/tmp',
      (output) => logs.push(output),
      () => {},
    );
    // Wait for command to finish
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(logs.some((l) => l.text.includes('hello'))).toBe(true);
  });

  it('getPlaybookState returns null for unknown session', () => {
    expect(getPlaybookState('nonexistent')).toBeNull();
  });

  it('stopPlaybook stops running commands', async () => {
    await startPlaybook(
      'session-2',
      {
        name: 'Long',
        commands: [{ label: 'Sleep', command: 'sleep 60' }],
      },
      '/tmp',
      () => {},
      () => {},
    );
    const state = getPlaybookState('session-2');
    expect(state).not.toBeNull();
    expect(state!.commands[0].status).toBe('running');
    await stopPlaybook('session-2');
    expect(getPlaybookState('session-2')).toBeNull();
  });

  it('starting a new playbook stops the previous one', async () => {
    await startPlaybook(
      'session-3',
      {
        name: 'First',
        commands: [{ label: 'Sleep', command: 'sleep 60' }],
      },
      '/tmp',
      () => {},
      () => {},
    );
    await startPlaybook(
      'session-3',
      {
        name: 'Second',
        commands: [{ label: 'Echo', command: 'echo replaced' }],
      },
      '/tmp',
      () => {},
      () => {},
    );
    const state = getPlaybookState('session-3');
    expect(state?.name).toBe('Second');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm -C server test`
Expected: FAIL — module doesn't exist

- [ ] **Step 4: Implement the playbook manager**

Create `server/src/playbook-manager.ts`:

```typescript
import concurrently from 'concurrently';

import type { PlaybookConfig } from './config.js';

const LOG_BUFFER_LIMIT = 100 * 1024; // 100KB

export interface LogEntry {
  source: string;
  text: string;
  timestamp: number;
}

export interface CommandStatus {
  label: string;
  status: 'running' | 'exited' | 'errored';
  exitCode?: number;
}

export interface PlaybookState {
  name: string;
  commands: CommandStatus[];
  logs: LogEntry[];
}

interface RunningPlaybook {
  name: string;
  commands: CommandStatus[];
  logs: LogEntry[];
  logSize: number;
  kill: () => void;
}

const runningPlaybooks = new Map<string, RunningPlaybook>();

export async function startPlaybook(
  sessionId: string,
  playbook: PlaybookConfig,
  cwd: string,
  onOutput: (entry: { source: string; text: string }) => void,
  onStatusChange: (commands: CommandStatus[]) => void,
): Promise<void> {
  // Stop any existing playbook for this session
  await stopPlaybook(sessionId);

  const commandStatuses: CommandStatus[] = playbook.commands.map((cmd) => ({
    label: cmd.label,
    status: 'running',
  }));

  const state: RunningPlaybook = {
    name: playbook.name,
    commands: commandStatuses,
    logs: [],
    logSize: 0,
    kill: () => {},
  };
  runningPlaybooks.set(sessionId, state);

  const { result, commands } = concurrently(
    playbook.commands.map((cmd, i) => ({
      command: cmd.command,
      name: cmd.label,
      prefixColor: '',
      env: { FORCE_COLOR: '1' },
      cwd,
      raw: true,
    })),
    { killOthers: ['failure'], raw: true },
  );

  state.kill = () => {
    for (const cmd of commands) {
      cmd.kill('SIGTERM');
    }
  };

  // Subscribe to per-command output
  for (let i = 0; i < commands.length; i++) {
    const label = playbook.commands[i].label;

    commands[i].stdout.subscribe((data) => {
      const text = typeof data === 'string' ? data : data.toString();
      addLog(state, label, text);
      onOutput({ source: label, text });
    });

    commands[i].stderr.subscribe((data) => {
      const text = typeof data === 'string' ? data : data.toString();
      addLog(state, label, text);
      onOutput({ source: label, text });
    });

    commands[i].close.subscribe((event) => {
      commandStatuses[i].exitCode = event.exitCode;
      commandStatuses[i].status = event.exitCode === 0 ? 'exited' : 'errored';
      onStatusChange([...commandStatuses]);
    });
  }

  onStatusChange([...commandStatuses]);

  // Clean up when all commands finish
  result
    .then(() => {
      // All exited successfully — keep state for log viewing
    })
    .catch(() => {
      // At least one errored — killOthers handled the rest
    })
    .finally(() => {
      runningPlaybooks.delete(sessionId);
      onStatusChange([...commandStatuses]);
    });
}

function addLog(state: RunningPlaybook, source: string, text: string): void {
  const entry: LogEntry = { source, text, timestamp: Date.now() };
  state.logs.push(entry);
  state.logSize += text.length;

  // Trim oldest entries when exceeding buffer limit
  while (state.logSize > LOG_BUFFER_LIMIT && state.logs.length > 1) {
    const removed = state.logs.shift()!;
    state.logSize -= removed.text.length;
  }
}

export function getPlaybookState(sessionId: string): PlaybookState | null {
  const running = runningPlaybooks.get(sessionId);
  if (!running) return null;
  return {
    name: running.name,
    commands: [...running.commands],
    logs: [...running.logs],
  };
}

export async function stopPlaybook(sessionId: string): Promise<void> {
  const running = runningPlaybooks.get(sessionId);
  if (!running) return;
  running.kill();
  runningPlaybooks.delete(sessionId);
  // Give processes a moment to exit
  await new Promise((resolve) => setTimeout(resolve, 100));
}

export async function stopAllPlaybooks(): Promise<void> {
  const ids = [...runningPlaybooks.keys()];
  for (const id of ids) {
    await stopPlaybook(id);
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm -C server test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add server/src/playbook-manager.ts server/test/playbook-manager.test.ts server/package.json
git commit -m "feat(playbooks): add playbook manager with concurrently execution"
```

---

### Task 4: Server Integration — WebSocket Messages and Routes

**Files:**

- Modify: `server/src/server.ts`
- Modify: `server/src/routes.ts`
- Modify: `server/src/sessions.ts`

- [ ] **Step 1: Update routes to pass config and persist playbook selection**

In `server/src/routes.ts`:

Add import at top:

```typescript
import type { PlaybookConfig } from './config.js';
```

Update `createRouter` signature to accept playbooks:

```typescript
export function createRouter(
  shell: string,
  initialCommand?: string,
  auxInitialCommand?: string,
  defaultDirectory?: string,
  statePath?: string,
  playbooks?: PlaybookConfig[],
): Router {
```

Update the `persistSessions` function to preserve playbook selections. Add a `sessionPlaybooks` map to track selections:

```typescript
const sessionPlaybooks = new Map<string, string>();
```

Update `persistSessions` to include playbook:

```typescript
function persistSessions(): void {
  const sessions = getAllPrimarySessions().map((s) => {
    const entry: { directory: string; playbook?: string } = { directory: s.directory };
    const pb = sessionPlaybooks.get(s.id);
    if (pb) entry.playbook = pb;
    return entry;
  });
  updateState(statePath, { sessions });
}
```

Update session restore (around line 86) to restore playbook selections. Silently clear playbook names that no longer exist in config:

```typescript
const savedState = loadState(statePath);
if (savedState.sessions && savedState.sessions.length > 0) {
  const playbookNames = new Set((playbooks ?? []).map((p) => p.name));
  const valid: { directory: string; playbook?: string }[] = [];
  for (const entry of savedState.sessions) {
    if (existsSync(entry.directory)) {
      const session = createSession(entry.directory, shell, initialCommand);
      // Only restore playbook if it still exists in config
      if (entry.playbook && playbookNames.has(entry.playbook)) {
        sessionPlaybooks.set(session.id, entry.playbook);
        valid.push(entry);
      } else {
        valid.push({ directory: entry.directory });
      }
    }
  }
  if (valid.length !== savedState.sessions.length) {
    updateState(statePath, { sessions: valid });
  }
}
```

Update `/api/config` endpoint to include playbooks:

```typescript
router.get('/api/config', (_req, res) => {
  res.json({ defaultDirectory, playbooks: playbooks ?? [] });
});
```

Update `/api/sessions` GET to include playbook selection:

```typescript
router.get('/api/sessions', (_req, res) => {
  const sessions = getAllPrimarySessions().map((s) => {
    const aux = getAuxSession(s.id);
    const entry: {
      id: string;
      directory: string;
      branch: string;
      auxId?: string;
      playbook?: string;
    } = {
      id: s.id,
      directory: s.directory,
      branch: s.branch,
    };
    if (aux) entry.auxId = aux.id;
    const pb = sessionPlaybooks.get(s.id);
    if (pb) entry.playbook = pb;
    return entry;
  });
  res.json(sessions);
});
```

Export `sessionPlaybooks` for use by server.ts:

```typescript
export { sessionPlaybooks };
```

Also handle cleanup in DELETE session handler — add before `deleteSession` call:

```typescript
sessionPlaybooks.delete(req.params.id);
```

- [ ] **Step 2: Update server.ts to pass config and handle playbook WebSocket messages**

In `server/src/server.ts`:

Add imports:

```typescript
import {
  startPlaybook,
  stopPlaybook,
  getPlaybookState,
  stopAllPlaybooks,
} from './playbook-manager.js';
import { sessionPlaybooks } from './routes.js';
import { updateState } from './state.js';
import { getAllPrimarySessions } from './sessions.js';
```

Note: `getSession`, `getAuxSession`, `killAllSessions`, `onBranchChange`, and the `Session` type are already imported from `sessions.js`. Just add `getAllPrimarySessions` to the existing import.

Update `createRouter` call to pass playbooks:

```typescript
app.use(
  createRouter(
    config.shell,
    config.initialCommand,
    config.auxInitialCommand,
    config.defaultDirectory,
    options.statePath,
    config.playbooks,
  ),
);
```

Add a helper function inside `startServer` (before the WebSocket handler) to persist playbook selections:

```typescript
function persistPlaybookSelection(statePath?: string): void {
  const allSessions = getAllPrimarySessions();
  const sessionEntries = allSessions.map((s) => {
    const entry: { directory: string; playbook?: string } = { directory: s.directory };
    const pb = sessionPlaybooks.get(s.id);
    if (pb) entry.playbook = pb;
    return entry;
  });
  updateState(statePath, { sessions: sessionEntries });
}
```

In the WebSocket `onmessage` handler (around line 136), add playbook message handling after the resize handler:

```typescript
if (msg.type === 'playbook:start' && typeof msg.playbookName === 'string') {
  const playbook = config.playbooks?.find((p) => p.name === msg.playbookName);
  if (!playbook) return;
  sessionPlaybooks.set(session.id, msg.playbookName);
  persistPlaybookSelection(options.statePath);

  startPlaybook(
    session.id,
    playbook,
    session.directory,
    (output) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({ type: 'playbook:output', source: output.source, text: output.text }),
        );
      }
    },
    (commands) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'playbook:status', commands }));
      }
    },
  );
  return;
}

if (msg.type === 'playbook:stop') {
  stopPlaybook(session.id);
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'playbook:stopped' }));
  }
  return;
}

if (msg.type === 'playbook:select' && typeof msg.playbookName === 'string') {
  sessionPlaybooks.set(session.id, msg.playbookName);
  persistPlaybookSelection(options.statePath);
  return;
}

if (msg.type === 'playbook:replay') {
  const state = getPlaybookState(session.id);
  if (state && ws.readyState === WebSocket.OPEN) {
    for (const log of state.logs) {
      ws.send(JSON.stringify({ type: 'playbook:output', source: log.source, text: log.text }));
    }
    ws.send(JSON.stringify({ type: 'playbook:status', commands: state.commands }));
  }
  return;
}
```

Update `cleanup` in the server resolve (around line 217) to also stop playbooks:

```typescript
cleanup: () => {
  stopNotificationWatcher();
  stopAllPlaybooks();
  killAllSessions();
  server.close();
},
```

- [ ] **Step 3: Update sessions.ts to stop playbooks on session deletion**

In `server/src/sessions.ts`:

Add import:

```typescript
import { stopPlaybook } from './playbook-manager.js';
```

Update `deleteSession` to stop playbook before killing PTY:

```typescript
export function deleteSession(id: string): void {
  const session = sessions.get(id);
  if (!session) return;
  stopPlaybook(id);
  // ... rest of existing code unchanged
}
```

Update `killAllSessions` to stop playbooks:

```typescript
export function killAllSessions(): void {
  for (const watcher of branchWatchers.values()) watcher.close();
  branchWatchers.clear();
  for (const session of sessions.values()) {
    stopPlaybook(session.id);
    session.scrollbackDisposable.dispose();
    killPty(session.pty);
  }
  sessions.clear();
  sessionOrder.length = 0;
}
```

- [ ] **Step 4: Run lint and type check**

Run: `pnpm -C server build && pnpm lint`
Expected: No errors

- [ ] **Step 5: Run all tests**

Run: `pnpm -C server test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add server/src/server.ts server/src/routes.ts server/src/sessions.ts
git commit -m "feat(playbooks): integrate playbook manager with WebSocket and routes"
```

---

### Task 5: Client Types and Config Loading

**Files:**

- Modify: `client/src/types.ts`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Add playbook types to client**

In `client/src/types.ts`:

```typescript
export type NotificationState = 'none' | 'idle' | 'permission' | 'working';

export type DisconnectReason = 'network' | 'pty_exited';

export interface PlaybookCommand {
  label: string;
  command: string;
}

export interface PlaybookConfig {
  name: string;
  commands: PlaybookCommand[];
}

export interface PlaybookCommandStatus {
  label: string;
  status: 'running' | 'exited' | 'errored';
  exitCode?: number;
}

export interface PlaybookLogEntry {
  source: string;
  text: string;
}

export interface Session {
  id: string;
  directory: string;
  branch: string;
  auxId?: string;
  playbook?: string;
}
```

- [ ] **Step 2: Update App.tsx to load playbooks from config**

In `client/src/App.tsx`:

Add import for new types:

```typescript
import type { Session, NotificationState, PlaybookConfig } from './types';
```

Add state for playbooks (after `loading` state, around line 30):

```typescript
const [playbooks, setPlaybooks] = useState<PlaybookConfig[]>([]);
const [showPlaybook, setShowPlaybook] = useState<Record<string, boolean>>({});
const showPlaybookRef = useRef(showPlaybook);
showPlaybookRef.current = showPlaybook;
```

Update the `/api/config` fetch (around line 43) to also extract playbooks:

```typescript
fetch('/api/config')
  .then((res) => res.json())
  .then((cfg: { defaultDirectory?: string; playbooks?: PlaybookConfig[] }) => {
    if (cfg.defaultDirectory) setDefaultDirectory(cfg.defaultDirectory);
    if (cfg.playbooks) setPlaybooks(cfg.playbooks);
  })
  .catch(() => {}),
```

- [ ] **Step 3: Run type check**

Run: `pnpm -C client build`
Expected: Build succeeds with no type errors

- [ ] **Step 4: Commit**

```bash
git add client/src/types.ts client/src/App.tsx
git commit -m "feat(playbooks): add client types and config loading"
```

---

### Task 6: Playbook Selector Component

**Files:**

- Create: `client/src/components/PlaybookSelector.tsx`

- [ ] **Step 1: Create the PlaybookSelector component**

Create `client/src/components/PlaybookSelector.tsx`:

```typescript
import { useState, useEffect, useRef } from 'react';

import type { PlaybookConfig } from '../types';

interface PlaybookSelectorProps {
  playbooks: PlaybookConfig[];
  onSelect: (playbook: PlaybookConfig) => void;
  onCancel: () => void;
}

function fuzzyMatch(
  pattern: string,
  candidate: string,
): { score: number; matchIndices: number[] } | null {
  if (pattern.length === 0) return { score: 0, matchIndices: [] };
  const pLower = pattern.toLowerCase();
  const cLower = candidate.toLowerCase();
  const matchIndices: number[] = [];
  let ci = 0;
  for (let pi = 0; pi < pLower.length; pi++) {
    const found = cLower.indexOf(pLower[pi], ci);
    if (found === -1) return null;
    matchIndices.push(found);
    ci = found + 1;
  }
  let score = 0;
  for (let i = 0; i < matchIndices.length; i++) {
    score += 1;
    if (matchIndices[i] === 0) score += 5;
    if (i > 0 && matchIndices[i] === matchIndices[i - 1] + 1) score += 4;
    if (i > 0) score -= matchIndices[i] - matchIndices[i - 1] - 1;
  }
  return { score, matchIndices };
}

function HighlightedName({ name, matchIndices }: { name: string; matchIndices: number[] }) {
  if (matchIndices.length === 0) return <span>{name}</span>;
  const indexSet = new Set(matchIndices);
  return (
    <span>
      {[...name].map((char, i) => (
        // oxlint-disable-next-line no-array-index-key
        <span key={i} className={indexSet.has(i) ? 'font-semibold text-blue-400' : ''}>
          {char}
        </span>
      ))}
    </span>
  );
}

export default function PlaybookSelector({ playbooks, onSelect, onCancel }: PlaybookSelectorProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = query
    ? playbooks
        .map((p) => ({ playbook: p, match: fuzzyMatch(query, p.name) }))
        .filter((r) => r.match !== null)
        .sort((a, b) => b.match!.score - a.match!.score)
        .map((r) => ({ playbook: r.playbook, matchIndices: r.match!.matchIndices }))
    : playbooks.map((p) => ({ playbook: p, matchIndices: [] as number[] }));

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'Enter') {
      if (filtered.length > 0) {
        onSelect(filtered[selectedIndex].playbook);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    }
  };

  return (
    <div
      className="absolute inset-0 z-10 flex items-start justify-center bg-black/60 pt-[20vh]"
      onClick={onCancel}
    >
      <div
        className="w-[500px] rounded-xl border border-white/10 bg-[#1a1a1a] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4">
          <label className="mb-2 block text-sm text-white/50">Select a playbook</label>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2.5 font-mono text-sm text-white/90 outline-none focus:border-blue-400/50"
            placeholder="Search playbooks..."
          />
        </div>

        {filtered.length > 0 && (
          <div className="max-h-60 overflow-y-auto border-t border-white/[0.06]">
            {filtered.map((item, i) => (
              <div
                key={item.playbook.name}
                onClick={() => onSelect(item.playbook)}
                className={`cursor-pointer px-4 py-2 text-sm ${
                  i === selectedIndex
                    ? 'bg-white/[0.07] text-white/90'
                    : 'text-white/40 hover:bg-white/[0.04]'
                }`}
              >
                <HighlightedName name={item.playbook.name} matchIndices={item.matchIndices} />
                <span className="ml-2 text-[11px] text-white/20">
                  {item.playbook.commands.length} command{item.playbook.commands.length !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        )}

        {filtered.length === 0 && query && (
          <div className="border-t border-white/[0.06] px-4 py-3 text-sm text-white/25">
            No matching playbooks
          </div>
        )}

        <div className="flex justify-between border-t border-white/[0.06] p-3 text-[11px] text-white/25">
          <span>Enter: select · Esc: cancel</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run type check**

Run: `pnpm -C client build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add client/src/components/PlaybookSelector.tsx
git commit -m "feat(playbooks): add fuzzy playbook selector modal"
```

---

### Task 7: Playbook View Component

**Files:**

- Create: `client/src/components/PlaybookView.tsx`

- [ ] **Step 1: Install ansi-to-html dependency**

```bash
cd /Users/work/projects/agent-mux && pnpm -C client add ansi-to-html --save-exact
```

Check if types are needed:

```bash
pnpm -C client add -D @types/ansi-to-html --save-exact 2>/dev/null || true
```

- [ ] **Step 2: Create the PlaybookView component**

Create `client/src/components/PlaybookView.tsx`:

```typescript
import AnsiToHtml from 'ansi-to-html';
import { useState, useRef, useEffect, useCallback } from 'react';

import { uiColors } from '../terminal-config';
import type { PlaybookCommandStatus, PlaybookLogEntry } from '../types';

const ansiConverter = new AnsiToHtml({
  fg: '#d8dee9',
  bg: 'transparent',
  escapeXML: true,
});

// Distinct colors for command labels
const LABEL_COLORS = [
  '#81a1c1', // blue
  '#a3be8c', // green
  '#ebcb8b', // yellow
  '#b48ead', // magenta
  '#88c0d0', // cyan
  '#bf616a', // red
  '#d08770', // orange
  '#5e81ac', // dark blue
];

interface PlaybookViewProps {
  playbookName: string;
  commands: PlaybookCommandStatus[];
  logs: PlaybookLogEntry[];
  isRunning: boolean;
  onStart: () => void;
  onStop: () => void;
  onChangePlaybook: () => void;
}

export default function PlaybookView({
  playbookName,
  commands,
  logs,
  isRunning,
  onStart,
  onStop,
  onChangePlaybook,
}: PlaybookViewProps) {
  const [activeFilters, setActiveFilters] = useState<Set<string>>(() => new Set(commands.map((c) => c.label)));
  const logContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const [showJumpToTail, setShowJumpToTail] = useState(false);

  // Update filters when commands change (new playbook selected)
  useEffect(() => {
    setActiveFilters(new Set(commands.map((c) => c.label)));
  }, [commands.map((c) => c.label).join(',')]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (isAtBottomRef.current && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs.length]);

  const handleScroll = useCallback(() => {
    const el = logContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    isAtBottomRef.current = atBottom;
    setShowJumpToTail(!atBottom);
  }, []);

  const jumpToTail = useCallback(() => {
    const el = logContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    isAtBottomRef.current = true;
    setShowJumpToTail(false);
  }, []);

  const toggleFilter = (label: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  const labelColorMap = new Map<string, string>();
  commands.forEach((cmd, i) => {
    labelColorMap.set(cmd.label, LABEL_COLORS[i % LABEL_COLORS.length]);
  });

  const filteredLogs = logs.filter((log) => activeFilters.has(log.source));

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: uiColors.pageBg }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 border-b px-4 py-2.5"
        style={{ borderColor: uiColors.sidebarBorder }}
      >
        <button
          onClick={onChangePlaybook}
          className="min-w-0 flex-1 truncate rounded-lg border px-3 py-1.5 text-left text-sm transition-colors hover:border-white/20"
          style={{
            borderColor: 'rgba(255,255,255,0.1)',
            color: uiColors.textPrimary,
          }}
        >
          {playbookName}
        </button>
        <button
          onClick={isRunning ? onStop : onStart}
          className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
          style={{
            backgroundColor: isRunning ? uiColors.dangerBg : 'rgba(163, 190, 140, 0.2)',
            color: isRunning ? uiColors.dangerText : '#a3be8c',
          }}
        >
          {isRunning ? 'Stop' : 'Start'}
        </button>
      </div>

      {/* Filter toggles */}
      <div
        className="flex gap-2 border-b px-4 py-2"
        style={{ borderColor: uiColors.sidebarBorder }}
      >
        {commands.map((cmd) => {
          const active = activeFilters.has(cmd.label);
          const color = labelColorMap.get(cmd.label) ?? uiColors.accent;
          return (
            <button
              key={cmd.label}
              onClick={() => toggleFilter(cmd.label)}
              className="rounded-md border px-2 py-0.5 text-xs transition-colors"
              style={{
                borderColor: active ? color : 'rgba(255,255,255,0.1)',
                color: active ? color : uiColors.textDim,
                backgroundColor: active ? `${color}15` : 'transparent',
              }}
            >
              {cmd.label}
              {cmd.status !== 'running' && (
                <span className="ml-1 opacity-50">
                  {cmd.status === 'exited' ? '\u2713' : '\u2717'}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Log stream */}
      <div
        ref={logContainerRef}
        onScroll={handleScroll}
        className="relative flex-1 overflow-y-auto p-4 font-mono text-sm"
      >
        {filteredLogs.map((log, i) => {
          const color = labelColorMap.get(log.source) ?? uiColors.accent;
          return (
            // oxlint-disable-next-line no-array-index-key
            <div key={i} className="whitespace-pre-wrap break-all leading-relaxed">
              <span style={{ color }} className="select-none font-semibold">
                [{log.source}]{' '}
              </span>
              <span
                className="text-white/80"
                dangerouslySetInnerHTML={{ __html: ansiConverter.toHtml(log.text) }}
              />
            </div>
          );
        })}

        {logs.length === 0 && (
          <div className="flex h-full items-center justify-center text-white/20">
            {isRunning ? 'Waiting for output...' : 'Press Start to run the playbook'}
          </div>
        )}
      </div>

      {/* Jump to tail */}
      {showJumpToTail && (
        <button
          onClick={jumpToTail}
          className="absolute bottom-4 right-6 rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-1.5 text-xs text-white/50 shadow-lg transition-colors hover:text-white/80"
        >
          Jump to tail
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run type check**

Run: `pnpm -C client build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add client/src/components/PlaybookView.tsx client/package.json
git commit -m "feat(playbooks): add playbook view with log stream and filters"
```

---

### Task 8: Integrate Playbook UI into App Shell

**Files:**

- Modify: `client/src/App.tsx`
- Modify: `client/src/components/TerminalPane.tsx`

- [ ] **Step 1: Add playbook state management and keyboard shortcut to App.tsx**

In `client/src/App.tsx`:

Add imports:

```typescript
import PlaybookSelector from './components/PlaybookSelector';
import PlaybookView from './components/PlaybookView';
import type {
  Session,
  NotificationState,
  PlaybookConfig,
  PlaybookCommandStatus,
  PlaybookLogEntry,
} from './types';
```

Add per-session playbook state (after the existing state declarations):

```typescript
const [playbookLogs, setPlaybookLogs] = useState<Record<string, PlaybookLogEntry[]>>({});
const [playbookStatuses, setPlaybookStatuses] = useState<Record<string, PlaybookCommandStatus[]>>(
  {},
);
const [playbookRunning, setPlaybookRunning] = useState<Record<string, boolean>>({});
const [showPlaybookSelector, setShowPlaybookSelector] = useState(false);
```

Add keyboard shortcut handler for `Ctrl/Cmd + \` (without Shift). In the existing keyboard handler useEffect, add before the existing `Backslash` handler:

```typescript
if (e.code === 'Backslash' && !e.shiftKey) {
  e.preventDefault();
  e.stopPropagation();
  if (playbooks.length === 0) return;
  const currentId = activeIdRef.current;
  if (!currentId) return;
  const session = sessionsRef.current.find((s) => s.id === currentId);
  if (!session?.playbook) {
    setShowPlaybookSelector(true);
  } else {
    setShowPlaybook((prev) => ({ ...prev, [currentId]: !prev[currentId] }));
  }
  return;
}
```

Update the existing `Backslash` handler check to require `e.shiftKey`:

```typescript
if (e.code === 'Backslash' && e.shiftKey) {
```

Update the modifier check at the top of the handler to allow non-shift for backslash:

```typescript
const mod = e.metaKey || e.ctrlKey;
if (!mod) return;
if (!e.shiftKey && e.code !== 'Backslash') return;
```

Add playbook selection handler:

```typescript
const handleSelectPlaybook = useCallback((playbook: PlaybookConfig) => {
  const currentId = activeIdRef.current;
  if (!currentId) return;
  setSessions((prev) =>
    prev.map((s) => (s.id === currentId ? { ...s, playbook: playbook.name } : s)),
  );
  setShowPlaybookSelector(false);
  setShowPlaybook((prev) => ({ ...prev, [currentId]: true }));
  // Persist selection via WebSocket
  // The actual WS message is sent from the usePlaybook hook
}, []);
```

Add playbook start/stop handlers:

```typescript
const handlePlaybookStart = useCallback((sessionId: string) => {
  const session = sessionsRef.current.find((s) => s.id === sessionId);
  if (!session?.playbook) return;
  setPlaybookLogs((prev) => ({ ...prev, [sessionId]: [] }));
  setPlaybookRunning((prev) => ({ ...prev, [sessionId]: true }));
  // Send start message via WebSocket — handled in useSession
}, []);

const handlePlaybookStop = useCallback((sessionId: string) => {
  setPlaybookRunning((prev) => ({ ...prev, [sessionId]: false }));
  // Send stop message via WebSocket — handled in useSession
}, []);
```

- [ ] **Step 2: Update TerminalPane.tsx to integrate PlaybookView with slide animation**

In `client/src/components/TerminalPane.tsx`:

Add imports:

```typescript
import PlaybookView from './PlaybookView';
import type { PlaybookCommandStatus, PlaybookLogEntry } from '../types';
```

Add props for playbook:

```typescript
interface TerminalPaneProps {
  session: Session;
  isActive: boolean;
  isActiveTab?: boolean;
  isAux?: boolean;
  showPlaybook?: boolean;
  playbookName?: string;
  playbookCommands?: PlaybookCommandStatus[];
  playbookLogs?: PlaybookLogEntry[];
  playbookRunning?: boolean;
  onPlaybookStart?: () => void;
  onPlaybookStop?: () => void;
  onChangePlaybook?: () => void;
  onNotification?: (sessionId: string, state: NotificationState) => void;
  onBranchUpdate?: (sessionId: string, branch: string) => void;
  onRestartSession?: () => void;
}
```

Compute playbook slide class similar to aux shell:

```typescript
const playbookSlide = showPlaybook ? 'translate-x-full' : '';
const playbookTransition = shouldAnimate ? 'transition-transform duration-200 ease-out' : '';

let playbookClass: string;
if (!isActiveTab) {
  playbookClass = 'invisible';
} else if (showPlaybook) {
  playbookClass = `${playbookTransition} translate-x-0`;
} else {
  playbookClass = `${playbookTransition} pointer-events-none translate-x-full`;
}

// Terminal pane shifts left when playbook is shown
let termPaneClass: string;
if (!isActiveTab) {
  termPaneClass = 'invisible';
} else if (!showPlaybook || isActive) {
  termPaneClass = `${transition} translate-x-0`;
} else {
  termPaneClass = `${transition} pointer-events-none -translate-x-full`;
}
```

Render the PlaybookView as a sibling pane:

```typescript
return (
  <>
    <div
      style={{ backgroundColor: terminalConfig.theme.background as string }}
      className={`absolute inset-0 ${showPlaybook && isActiveTab ? `${playbookTransition} pointer-events-none -translate-x-full` : paneClass}`}
    >
      <div ref={containerRef} className="h-full w-full" />
      {disconnectReason && (
        <DisconnectOverlay
          reason={disconnectReason}
          onReconnect={reconnect}
          onNewSession={() => onRestartSession?.()}
        />
      )}
    </div>
    {playbookName && isActiveTab && (
      <div className={`absolute inset-0 ${playbookClass}`}>
        <PlaybookView
          playbookName={playbookName}
          commands={playbookCommands ?? []}
          logs={playbookLogs ?? []}
          isRunning={playbookRunning ?? false}
          onStart={() => onPlaybookStart?.()}
          onStop={() => onPlaybookStop?.()}
          onChangePlaybook={() => onChangePlaybook?.()}
        />
      </div>
    )}
  </>
);
```

- [ ] **Step 3: Wire up playbook props in App.tsx render**

Update the session rendering in App.tsx to pass playbook props to TerminalPane:

```typescript
{sessions.map((session) => (
  <Fragment key={session.id}>
    <TerminalPane
      session={session}
      isActive={session.id === activeId && activeShell[session.id] !== 'aux'}
      isActiveTab={session.id === activeId}
      showPlaybook={showPlaybook[session.id] ?? false}
      playbookName={session.playbook}
      playbookCommands={playbookStatuses[session.id]}
      playbookLogs={playbookLogs[session.id]}
      playbookRunning={playbookRunning[session.id]}
      onPlaybookStart={() => handlePlaybookStart(session.id)}
      onPlaybookStop={() => handlePlaybookStop(session.id)}
      onChangePlaybook={() => setShowPlaybookSelector(true)}
      onNotification={handleNotification}
      onBranchUpdate={handleBranchUpdate}
      onRestartSession={() => handleRestartSession(session.id)}
    />
    {session.auxId && (
      <TerminalPane
        key={session.auxId}
        session={{ ...session, id: session.auxId }}
        isActive={session.id === activeId && activeShell[session.id] === 'aux'}
        isActiveTab={session.id === activeId}
        isAux
        onRestartSession={() => handleRestartAuxSession(session.id)}
      />
    )}
  </Fragment>
))}
```

Add the PlaybookSelector modal render (after the DirectoryPicker):

```typescript
{showPlaybookSelector && (
  <PlaybookSelector
    playbooks={playbooks}
    onSelect={handleSelectPlaybook}
    onCancel={() => setShowPlaybookSelector(false)}
  />
)}
```

- [ ] **Step 4: Run type check and lint**

Run: `pnpm -C client build && pnpm lint`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add client/src/App.tsx client/src/components/TerminalPane.tsx
git commit -m "feat(playbooks): integrate playbook UI with slide animation and keyboard shortcut"
```

---

### Task 9: WebSocket Playbook Message Handling in Client

**Files:**

- Modify: `client/src/hooks/useSession.ts`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Add playbook message callbacks to useSession hook**

In `client/src/hooks/useSession.ts`:

Add types import:

```typescript
import type {
  DisconnectReason,
  NotificationState,
  PlaybookCommandStatus,
  PlaybookLogEntry,
} from '../types';
```

Add new callback parameters to `useSession`:

```typescript
export function useSession(
  sessionId: string,
  containerRef: React.RefObject<HTMLDivElement | null>,
  isActive: boolean,
  onNotification?: (sessionId: string, state: NotificationState) => void,
  onBranchUpdate?: (sessionId: string, branch: string) => void,
  onPlaybookOutput?: (entry: PlaybookLogEntry) => void,
  onPlaybookStatus?: (commands: PlaybookCommandStatus[]) => void,
  onPlaybookStopped?: () => void,
): UseSessionResult {
```

Add refs for the new callbacks:

```typescript
const onPlaybookOutputRef = useRef(onPlaybookOutput);
onPlaybookOutputRef.current = onPlaybookOutput;
const onPlaybookStatusRef = useRef(onPlaybookStatus);
onPlaybookStatusRef.current = onPlaybookStatus;
const onPlaybookStoppedRef = useRef(onPlaybookStopped);
onPlaybookStoppedRef.current = onPlaybookStopped;
```

In the `ws.onmessage` handler, add playbook message parsing after the existing `branch_update` check:

```typescript
if (msg.type === 'playbook:output') {
  onPlaybookOutputRef.current?.({ source: msg.source, text: msg.text });
  return;
}
if (msg.type === 'playbook:status') {
  onPlaybookStatusRef.current?.(msg.commands);
  return;
}
if (msg.type === 'playbook:stopped') {
  onPlaybookStoppedRef.current?.();
  return;
}
```

Add a `sendMessage` function exposed from the hook for sending playbook control messages:

```typescript
const sendMessage = useCallback((msg: object) => {
  const ws = wsRef.current;
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}, []);

return { disconnectReason, reconnect, sendMessage };
```

Update the `UseSessionResult` interface:

```typescript
export interface UseSessionResult {
  disconnectReason: DisconnectReason | null;
  reconnect: () => void;
  sendMessage: (msg: object) => void;
}
```

- [ ] **Step 2: Wire up WebSocket messages in TerminalPane**

In `client/src/components/TerminalPane.tsx`, update the `useSession` call to receive `sendMessage` and pass playbook callbacks through:

Add callback props:

```typescript
interface TerminalPaneProps {
  // ... existing props ...
  onPlaybookOutput?: (entry: PlaybookLogEntry) => void;
  onPlaybookStatusChange?: (commands: PlaybookCommandStatus[]) => void;
  onPlaybookStopped?: () => void;
  sendPlaybookMessage?: (msg: object) => void;
}
```

Actually, a cleaner approach: expose `sendMessage` from TerminalPane back to App via a ref or callback. The simplest approach is to have App pass the start/stop handlers that know the session ID, and have TerminalPane call `sendMessage` when the user clicks start/stop.

Update TerminalPane to expose sendMessage:

```typescript
const { disconnectReason, reconnect, sendMessage } = useSession(
  session.id,
  containerRef,
  isActive,
  onNotification,
  onBranchUpdate,
  onPlaybookOutput,
  onPlaybookStatusChange,
  onPlaybookStopped,
);
```

Wire up the PlaybookView start/stop to send WebSocket messages:

```typescript
onStart={() => {
  sendMessage({ type: 'playbook:start', playbookName: playbookName });
  onPlaybookStart?.();
}}
onStop={() => {
  sendMessage({ type: 'playbook:stop' });
  onPlaybookStop?.();
}}
```

- [ ] **Step 3: Wire up App.tsx to handle playbook WebSocket events**

In App.tsx, update the TerminalPane rendering to pass playbook event handlers that update state:

```typescript
<TerminalPane
  // ... existing props ...
  onPlaybookOutput={(entry) => {
    setPlaybookLogs((prev) => ({
      ...prev,
      [session.id]: [...(prev[session.id] ?? []), entry],
    }));
  }}
  onPlaybookStatusChange={(commands) => {
    setPlaybookStatuses((prev) => ({ ...prev, [session.id]: commands }));
    const allDone = commands.every((c) => c.status !== 'running');
    if (allDone) {
      setPlaybookRunning((prev) => ({ ...prev, [session.id]: false }));
    }
  }}
  onPlaybookStopped={() => {
    setPlaybookRunning((prev) => ({ ...prev, [session.id]: false }));
  }}
/>
```

- [ ] **Step 4: Send playbook:select and playbook:replay on selection**

When a playbook is selected, we need to notify the server and request any existing log replay. Update `handleSelectPlaybook`:

The WebSocket message needs to be sent from the TerminalPane that has the active WS connection. Add a mechanism for App to trigger messages. The cleanest approach is a ref-based callback.

Add to App.tsx:

```typescript
const sendPlaybookMessageRef = useRef<Record<string, (msg: object) => void>>({});
```

Add prop `onSendMessage` to TerminalPane:

```typescript
onSendMessage={(sendFn) => {
  sendPlaybookMessageRef.current[session.id] = sendFn;
}}
```

In TerminalPane, call `onSendMessage` when the WS is ready:

```typescript
useEffect(() => {
  onSendMessage?.(sendMessage);
}, [sendMessage, onSendMessage]);
```

Then in `handleSelectPlaybook`:

```typescript
const handleSelectPlaybook = useCallback((playbook: PlaybookConfig) => {
  const currentId = activeIdRef.current;
  if (!currentId) return;
  setSessions((prev) =>
    prev.map((s) => (s.id === currentId ? { ...s, playbook: playbook.name } : s)),
  );
  setShowPlaybookSelector(false);
  setShowPlaybook((prev) => ({ ...prev, [currentId]: true }));
  sendPlaybookMessageRef.current[currentId]?.({
    type: 'playbook:select',
    playbookName: playbook.name,
  });
  // Request log replay if playbook was already running
  sendPlaybookMessageRef.current[currentId]?.({ type: 'playbook:replay' });
}, []);
```

- [ ] **Step 5: Run type check, lint, and test**

Run: `pnpm -C client build && pnpm lint && pnpm -C server test`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add client/src/hooks/useSession.ts client/src/components/TerminalPane.tsx client/src/App.tsx
git commit -m "feat(playbooks): wire up WebSocket playbook messages between client and server"
```

---

### Task 10: End-to-End Testing and Polish

**Files:**

- Various minor fixes across touched files

- [ ] **Step 1: Run full build**

```bash
cd /Users/work/projects/agent-mux && pnpm -C client build && pnpm -C server build
```

Expected: Clean build with no errors

- [ ] **Step 2: Run all tests**

```bash
pnpm -C server test
```

Expected: All tests pass

- [ ] **Step 3: Run lint and format**

```bash
pnpm check
```

Expected: No lint or format errors. If there are errors, run `pnpm lint:fix && pnpm fmt` and fix any remaining issues manually.

- [ ] **Step 4: Manual testing**

Set up a test config.json with playbooks:

```json
{
  "playbooks": [
    {
      "name": "Test Playbook",
      "commands": [
        {
          "label": "Server",
          "command": "node -e \"setInterval(() => console.log('server ping'), 1000)\""
        },
        {
          "label": "Client",
          "command": "node -e \"setInterval(() => console.log('client ping'), 1500)\""
        }
      ]
    }
  ]
}
```

Test the following:

1. `Ctrl/Cmd + \` opens selector when no playbook is set
2. Selecting a playbook shows PlaybookView with slide animation
3. Start button starts commands, logs appear with prefixed labels
4. Filter toggles hide/show command logs
5. Scroll up pauses auto-scroll, "Jump to tail" button appears
6. Stop button kills all commands
7. Switching tabs preserves log state
8. `Ctrl/Cmd + \` toggles playbook view on/off
9. Clicking playbook name reopens selector
10. Selecting a new playbook while one is running stops the old one
11. Playbook selection persists across app restart (but not running state)
12. `Ctrl/Cmd + Shift + \` still toggles aux shell correctly

- [ ] **Step 5: Fix any issues found during manual testing**

Address any bugs or polish items found during testing.

- [ ] **Step 6: Commit final polish**

```bash
git add -A
git commit -m "feat(playbooks): polish and manual testing fixes"
```

---

### Task 11: Update pnpm lockfile

**Files:**

- Root `pnpm-lock.yaml`

- [ ] **Step 1: Ensure lockfile is up to date**

```bash
cd /Users/work/projects/agent-mux && pnpm install
```

- [ ] **Step 2: Commit lockfile if changed**

```bash
git add pnpm-lock.yaml
git commit -m "chore: update pnpm lockfile for playbook dependencies"
```
