# Agent Mux (Web) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-based terminal multiplexer with a React/Tailwind sidebar and xterm.js terminal panes, backed by a Node.js server that spawns PTYs and communicates over WebSocket.

**Architecture:** Monorepo with two packages — `server/` (Express + ws + node-pty) and `client/` (React + Tailwind v4 + xterm.js + Vite). REST API for session lifecycle, WebSocket per session for PTY I/O. Server serves built client in production; Vite dev server proxies to backend in development.

**Tech Stack:** Node.js 22, TypeScript, pnpm, Express, ws, node-pty, React, Tailwind CSS v4, xterm.js, Vite

---

## File Structure

```
agent-mux/
├── .mise.toml
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts            # express + ws bootstrap, static serving, cleanup
│       ├── config.ts           # load config.json, shell/port defaults
│       ├── pty-manager.ts      # node-pty spawn/resize/kill
│       ├── sessions.ts         # session state map, CRUD, git branch
│       └── routes.ts           # REST endpoints + directory listing
├── client/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── main.css
│       ├── App.tsx
│       ├── types.ts
│       ├── components/
│       │   ├── Sidebar.tsx
│       │   ├── TabItem.tsx
│       │   ├── TerminalPane.tsx
│       │   └── DirectoryPicker.tsx
│       └── hooks/
│           └── useSession.ts
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `.mise.toml`
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/src/index.ts`
- Create: `client/package.json`
- Create: `client/tsconfig.json`
- Create: `client/vite.config.ts`
- Create: `client/index.html`
- Create: `client/src/main.tsx`
- Create: `client/src/main.css`

- [ ] **Step 1: Create `.mise.toml`**

```toml
[tools]
node = "22"
pnpm = "10"
```

- [ ] **Step 2: Create `server/package.json`**

```json
{
  "name": "agent-mux-server",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "build": "tsc",
    "test": "vitest run --passWithNoTests"
  },
  "pnpm": {
    "onlyBuiltDependencies": ["node-pty"]
  }
}
```

- [ ] **Step 3: Create `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Install server dependencies**

Run:
```bash
cd server
pnpm add express ws node-pty
pnpm add -D typescript tsx vitest @types/node @types/express @types/ws
```

- [ ] **Step 5: Create minimal `server/src/index.ts`**

```ts
console.log('agent-mux server starting...');
```

- [ ] **Step 6: Verify server runs**

Run: `cd server && pnpm start`
Expected: prints "agent-mux server starting..."

- [ ] **Step 7: Create `client/package.json`**

```json
{
  "name": "agent-mux-client",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

- [ ] **Step 8: Create `client/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
```

- [ ] **Step 9: Install client dependencies**

Run:
```bash
cd client
pnpm add react react-dom @xterm/xterm @xterm/addon-fit
pnpm add -D typescript vite @vitejs/plugin-react @tailwindcss/vite tailwindcss @types/react @types/react-dom
```

- [ ] **Step 10: Create `client/vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/ws': {
        target: 'http://localhost:3000',
        ws: true,
      },
    },
  },
});
```

- [ ] **Step 11: Create `client/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>agent-mux</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 12: Create `client/src/main.css`**

```css
@import "tailwindcss";
@import "@xterm/xterm/css/xterm.css";

html, body, #root {
  height: 100%;
  margin: 0;
  overflow: hidden;
}
```

- [ ] **Step 13: Create `client/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './main.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="h-full bg-[#0c0c0c] text-white flex items-center justify-center">
      agent-mux client
    </div>
  </StrictMode>,
);
```

- [ ] **Step 14: Verify client dev server runs**

Run: `cd client && pnpm dev`
Expected: Vite starts on http://localhost:5173, browser shows "agent-mux client" on dark background

- [ ] **Step 15: Commit**

```bash
git add .mise.toml server/ client/
git commit -m "feat: scaffold server and client packages"
```

---

### Task 2: Server — Config + PTY Manager

**Files:**
- Create: `server/src/config.ts`
- Create: `server/src/pty-manager.ts`
- Create: `server/test/config.test.ts`

- [ ] **Step 1: Write failing tests for config loading**

Create `server/test/config.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  const configPath = 'config.json';

  afterEach(() => {
    if (existsSync(configPath)) unlinkSync(configPath);
  });

  it('returns defaults when no config.json exists', () => {
    const config = loadConfig();
    expect(config.port).toBe(3000);
    expect(typeof config.shell).toBe('string');
    expect(config.shell.length).toBeGreaterThan(0);
  });

  it('reads shell from config.json', () => {
    writeFileSync(configPath, JSON.stringify({ shell: '/bin/bash' }));
    const config = loadConfig();
    expect(config.shell).toBe('/bin/bash');
  });

  it('reads port from config.json', () => {
    writeFileSync(configPath, JSON.stringify({ port: 4000 }));
    const config = loadConfig();
    expect(config.port).toBe(4000);
  });

  it('uses defaults for missing fields', () => {
    writeFileSync(configPath, JSON.stringify({}));
    const config = loadConfig();
    expect(config.port).toBe(3000);
    expect(typeof config.shell).toBe('string');
  });

  it('handles invalid JSON gracefully', () => {
    writeFileSync(configPath, 'not json');
    const config = loadConfig();
    expect(config.port).toBe(3000);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && pnpm test`
Expected: FAIL — cannot resolve `../src/config.js`

- [ ] **Step 3: Implement `server/src/config.ts`**

```ts
import { readFileSync, existsSync } from 'node:fs';
import { platform } from 'node:os';

export interface Config {
  shell: string;
  port: number;
}

function defaultShell(): string {
  if (platform() === 'win32') return 'powershell.exe';
  return process.env.SHELL || '/bin/sh';
}

export function loadConfig(): Config {
  const defaults: Config = {
    shell: defaultShell(),
    port: 3000,
  };

  if (!existsSync('config.json')) return defaults;

  try {
    const raw = JSON.parse(readFileSync('config.json', 'utf-8'));
    return {
      shell: typeof raw.shell === 'string' ? raw.shell : defaults.shell,
      port: typeof raw.port === 'number' ? raw.port : defaults.port,
    };
  } catch {
    return defaults;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && pnpm test`
Expected: all tests PASS

- [ ] **Step 5: Implement `server/src/pty-manager.ts`**

```ts
import { spawn, type IPty } from 'node-pty';

export function createPty(
  shell: string,
  cwd: string,
  cols: number,
  rows: number,
): IPty {
  return spawn(shell, [], {
    cwd,
    cols,
    rows,
    name: 'xterm-256color',
    env: { ...process.env, TERM: 'xterm-256color' },
  });
}

export function resizePty(pty: IPty, cols: number, rows: number): void {
  pty.resize(cols, rows);
}

export function killPty(pty: IPty): void {
  pty.kill();
}
```

- [ ] **Step 6: Verify compilation**

Run: `cd server && pnpm exec tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add server/src/config.ts server/src/pty-manager.ts server/test/config.test.ts
git commit -m "feat(server): add config loading and PTY manager"
```

---

### Task 3: Server — Sessions

**Files:**
- Create: `server/src/sessions.ts`
- Create: `server/test/sessions.test.ts`

- [ ] **Step 1: Write failing tests for session management**

Create `server/test/sessions.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSession,
  getSession,
  getAllSessions,
  deleteSession,
  killAllSessions,
  type Session,
} from '../src/sessions.js';

// Mock shell that exists on all platforms
const TEST_SHELL = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh';

describe('sessions', () => {
  beforeEach(() => {
    killAllSessions();
  });

  it('createSession adds a session', () => {
    const session = createSession('/tmp', TEST_SHELL);
    expect(session.id).toBeTruthy();
    expect(session.directory).toBe('/tmp');
    expect(session.pty).toBeTruthy();
  });

  it('getSession retrieves by id', () => {
    const session = createSession('/tmp', TEST_SHELL);
    const found = getSession(session.id);
    expect(found).toBe(session);
  });

  it('getSession returns undefined for unknown id', () => {
    expect(getSession('nonexistent')).toBeUndefined();
  });

  it('getAllSessions returns all sessions', () => {
    createSession('/tmp', TEST_SHELL);
    createSession('/tmp', TEST_SHELL);
    expect(getAllSessions()).toHaveLength(2);
  });

  it('deleteSession removes and kills PTY', () => {
    const session = createSession('/tmp', TEST_SHELL);
    deleteSession(session.id);
    expect(getSession(session.id)).toBeUndefined();
    expect(getAllSessions()).toHaveLength(0);
  });

  it('killAllSessions clears everything', () => {
    createSession('/tmp', TEST_SHELL);
    createSession('/tmp', TEST_SHELL);
    killAllSessions();
    expect(getAllSessions()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && pnpm test`
Expected: FAIL — cannot resolve `../src/sessions.js`

- [ ] **Step 3: Implement `server/src/sessions.ts`**

```ts
import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
import { type IPty } from 'node-pty';
import { createPty, killPty } from './pty-manager.js';

export interface Session {
  id: string;
  directory: string;
  branch: string;
  pty: IPty;
}

const sessions = new Map<string, Session>();

export function createSession(directory: string, shell: string): Session {
  const pty = createPty(shell, directory, 80, 24);
  const session: Session = {
    id: randomUUID(),
    directory,
    branch: getGitBranch(directory),
    pty,
  };
  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}

export function getAllSessions(): Session[] {
  return Array.from(sessions.values());
}

export function deleteSession(id: string): void {
  const session = sessions.get(id);
  if (!session) return;
  killPty(session.pty);
  sessions.delete(id);
}

export function killAllSessions(): void {
  for (const session of sessions.values()) {
    killPty(session.pty);
  }
  sessions.clear();
}

function getGitBranch(directory: string): string {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: directory,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && pnpm test`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/sessions.ts server/test/sessions.test.ts
git commit -m "feat(server): add session management with PTY lifecycle"
```

---

### Task 4: Server — Routes + Directory Listing

**Files:**
- Create: `server/src/routes.ts`
- Create: `server/test/routes.test.ts`

- [ ] **Step 1: Write failing tests for directory listing**

Create `server/test/routes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { listDirectories } from '../src/routes.js';

describe('listDirectories', () => {
  it('lists subdirectories for a trailing slash path', () => {
    const dirs = listDirectories('/tmp/');
    expect(Array.isArray(dirs)).toBe(true);
  });

  it('filters by prefix', () => {
    // The home directory should have some subdirectories
    const home = process.env.HOME || '/tmp';
    const dirs = listDirectories(home + '/');
    expect(dirs.length).toBeGreaterThan(0);
    for (const dir of dirs) {
      expect(dir.startsWith(home + '/')).toBe(true);
    }
  });

  it('expands tilde to home directory', () => {
    const dirs = listDirectories('~/');
    const home = process.env.HOME || '';
    expect(dirs.length).toBeGreaterThan(0);
    for (const dir of dirs) {
      expect(dir.startsWith(home + '/')).toBe(true);
    }
  });

  it('returns empty array for nonexistent path', () => {
    const dirs = listDirectories('/nonexistent/path/xyz/');
    expect(dirs).toEqual([]);
  });

  it('filters hidden directories', () => {
    const home = process.env.HOME || '/tmp';
    const dirs = listDirectories(home + '/');
    for (const dir of dirs) {
      const name = dir.split('/').pop()!;
      expect(name.startsWith('.')).toBe(false);
    }
  });

  it('returns empty for empty prefix', () => {
    const dirs = listDirectories('');
    expect(dirs).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && pnpm test`
Expected: FAIL — cannot resolve `../src/routes.js`

- [ ] **Step 3: Implement `server/src/routes.ts`**

```ts
import { Router } from 'express';
import { readdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { homedir } from 'node:os';
import {
  createSession,
  getAllSessions,
  deleteSession,
  getSession,
} from './sessions.js';

export function listDirectories(prefix: string): string[] {
  if (!prefix) return [];

  const expanded = prefix.startsWith('~')
    ? homedir() + prefix.slice(1)
    : prefix;

  try {
    if (expanded.endsWith('/')) {
      const entries = readdirSync(expanded, { withFileTypes: true });
      return entries
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
        .map((e) => expanded + e.name)
        .slice(0, 20);
    }

    const parent = dirname(expanded);
    const partial = basename(expanded).toLowerCase();
    const entries = readdirSync(parent, { withFileTypes: true });
    return entries
      .filter(
        (e) =>
          e.isDirectory() &&
          !e.name.startsWith('.') &&
          e.name.toLowerCase().startsWith(partial),
      )
      .map((e) => resolve(parent, e.name))
      .slice(0, 20);
  } catch {
    return [];
  }
}

export function createRouter(shell: string): Router {
  const router = Router();

  router.post('/api/sessions', (req, res) => {
    const { directory } = req.body;
    if (!directory || typeof directory !== 'string') {
      res.status(400).json({ error: 'directory is required' });
      return;
    }
    const session = createSession(directory, shell);
    res.json({
      id: session.id,
      directory: session.directory,
      branch: session.branch,
    });
  });

  router.get('/api/sessions', (_req, res) => {
    const sessions = getAllSessions().map((s) => ({
      id: s.id,
      directory: s.directory,
      branch: s.branch,
    }));
    res.json(sessions);
  });

  router.delete('/api/sessions/:id', (req, res) => {
    deleteSession(req.params.id);
    res.status(204).end();
  });

  router.get('/api/directories', (req, res) => {
    const prefix = (req.query.prefix as string) || '';
    res.json(listDirectories(prefix));
  });

  return router;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && pnpm test`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/routes.ts server/test/routes.test.ts
git commit -m "feat(server): add REST routes and directory listing"
```

---

### Task 5: Server — WebSocket + Bootstrap

**Files:**
- Modify: `server/src/index.ts` (replace placeholder)

- [ ] **Step 1: Implement `server/src/index.ts`**

Replace the placeholder with:

```ts
import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { resolve } from 'node:path';
import { loadConfig } from './config.js';
import { createRouter } from './routes.js';
import { getSession, killAllSessions } from './sessions.js';
import { resizePty } from './pty-manager.js';

const config = loadConfig();
const app = express();

app.use(express.json());
app.use(createRouter(config.shell));

// Serve client build in production
const clientDist = resolve(import.meta.dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res, next) => {
  // Only serve index.html for non-API routes
  if (_req.path.startsWith('/api')) return next();
  res.sendFile(resolve(clientDist, 'index.html'), (err) => {
    if (err) next();
  });
});

const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

// Handle WebSocket upgrade on /ws/:sessionId
server.on('upgrade', (req, socket, head) => {
  const match = req.url?.match(/^\/ws\/(.+)$/);
  if (!match) {
    socket.destroy();
    return;
  }

  const session = getSession(match[1]);
  if (!session) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req, session);
  });
});

wss.on('connection', (ws: WebSocket, _req, session) => {
  // PTY → client
  const dataHandler = session.pty.onData((data: string) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });

  // Client → PTY
  ws.on('message', (raw: Buffer | string) => {
    const str = raw.toString();

    // Check for JSON control messages
    if (str.startsWith('{')) {
      try {
        const msg = JSON.parse(str);
        if (msg.type === 'resize' && typeof msg.cols === 'number' && typeof msg.rows === 'number') {
          resizePty(session.pty, msg.cols, msg.rows);
          return;
        }
      } catch {
        // Not valid JSON — treat as terminal input
      }
    }

    session.pty.write(str);
  });

  ws.on('close', () => {
    dataHandler.dispose();
  });
});

server.listen(config.port, () => {
  console.log(`agent-mux listening on http://localhost:${config.port}`);
});

// Cleanup
function cleanup() {
  killAllSessions();
  server.close();
}

process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });
process.on('SIGHUP', () => { cleanup(); process.exit(0); });
process.on('uncaughtException', (err) => {
  console.error('agent-mux crashed:', err);
  cleanup();
  process.exit(1);
});
```

- [ ] **Step 2: Verify compilation**

Run: `cd server && pnpm exec tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Verify server starts**

Run: `cd server && pnpm start`
Expected: prints "agent-mux listening on http://localhost:3000"

- [ ] **Step 4: Test REST API with curl**

Run (in another terminal):
```bash
# Create session
curl -s -X POST http://localhost:3000/api/sessions \
  -H 'Content-Type: application/json' \
  -d '{"directory":"/tmp"}'

# List sessions
curl -s http://localhost:3000/api/sessions
```

Expected: JSON responses with session data

- [ ] **Step 5: Commit**

```bash
git add server/src/index.ts
git commit -m "feat(server): add WebSocket handler and express bootstrap"
```

---

### Task 6: Client — React + Tailwind + Layout Shell

**Files:**
- Create: `client/src/types.ts`
- Create: `client/src/App.tsx`
- Modify: `client/src/main.tsx` (import App)

- [ ] **Step 1: Create `client/src/types.ts`**

```ts
export interface Session {
  id: string;
  directory: string;
  branch: string;
}
```

- [ ] **Step 2: Create `client/src/App.tsx`**

```tsx
import { useState } from 'react';
import type { Session } from './types';

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <div className="h-full flex bg-[#0c0c0c] text-[#e4e4e7] font-sans">
      {/* Sidebar */}
      <div className="w-60 min-w-60 bg-white/[0.03] border-r border-white/[0.06] flex flex-col">
        <div className="flex-1 p-2 flex flex-col gap-0.5 overflow-y-auto">
          {sessions.length === 0 && (
            <p className="text-white/30 text-sm p-3">No sessions</p>
          )}
        </div>
        <div className="p-2 border-t border-white/[0.06]">
          <button className="w-full p-2.5 rounded-[10px] text-center text-sm text-white/30 border border-dashed border-white/[0.08] hover:border-white/20 hover:text-white/50 transition-all">
            + New tab
          </button>
        </div>
      </div>

      {/* Terminal pane */}
      <div className="flex-1 relative">
        {sessions.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-white/20 text-sm">
            Open a tab to get started
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update `client/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './main.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 4: Verify dev server shows layout**

Run: `cd client && pnpm dev`
Expected: Browser shows dark layout with sidebar (empty, "No sessions" text) and "Open a tab to get started" in the main area. "+ New tab" button at bottom of sidebar.

- [ ] **Step 5: Commit**

```bash
git add client/src/types.ts client/src/App.tsx client/src/main.tsx
git commit -m "feat(client): add App shell with sidebar and terminal pane layout"
```

---

### Task 7: Client — Sidebar + TabItem

**Files:**
- Create: `client/src/components/Sidebar.tsx`
- Create: `client/src/components/TabItem.tsx`
- Modify: `client/src/App.tsx` (use Sidebar)

- [ ] **Step 1: Create `client/src/components/TabItem.tsx`**

```tsx
import type { Session } from '../types';

interface TabItemProps {
  session: Session;
  isActive: boolean;
  onClick: () => void;
  onClose: () => void;
}

export default function TabItem({ session, isActive, onClick, onClose }: TabItemProps) {
  const dirName = session.directory.split('/').pop() || session.directory;

  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-[10px] cursor-pointer transition-all ${
        isActive
          ? 'bg-white/[0.07] border-l-[3px] border-l-blue-400'
          : 'border-l-[3px] border-l-transparent hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-[13px] font-medium ${isActive ? 'text-[#f4f4f5]' : 'text-white/55'}`}>
          {dirName}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="text-white/10 hover:text-white/40 text-[10px] w-[18px] h-[18px] flex items-center justify-center rounded transition-all"
        >
          ×
        </button>
      </div>
      {session.branch && (
        <div className={`text-[11px] mt-1 ${isActive ? 'text-white/35' : 'text-white/20'}`}>
          {session.branch}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `client/src/components/Sidebar.tsx`**

```tsx
import type { Session } from '../types';
import TabItem from './TabItem';

interface SidebarProps {
  sessions: Session[];
  activeId: string | null;
  onSelectSession: (id: string) => void;
  onCloseSession: (id: string) => void;
  onNewTab: () => void;
}

export default function Sidebar({
  sessions,
  activeId,
  onSelectSession,
  onCloseSession,
  onNewTab,
}: SidebarProps) {
  return (
    <div className="w-60 min-w-60 bg-white/[0.03] border-r border-white/[0.06] flex flex-col">
      <div className="flex-1 p-2 flex flex-col gap-0.5 overflow-y-auto">
        {sessions.map((session) => (
          <TabItem
            key={session.id}
            session={session}
            isActive={session.id === activeId}
            onClick={() => onSelectSession(session.id)}
            onClose={() => onCloseSession(session.id)}
          />
        ))}
      </div>
      <div className="p-2 border-t border-white/[0.06]">
        <button
          onClick={onNewTab}
          className="w-full p-2.5 rounded-[10px] text-center text-sm text-white/30 border border-dashed border-white/[0.08] hover:border-white/20 hover:text-white/50 transition-all"
        >
          + New tab
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update `client/src/App.tsx` to use Sidebar**

```tsx
import { useState } from 'react';
import type { Session } from './types';
import Sidebar from './components/Sidebar';

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const handleCloseSession = async (id: string) => {
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setActiveId((prev) => {
      if (prev !== id) return prev;
      const remaining = sessions.filter((s) => s.id !== id);
      return remaining.length > 0 ? remaining[0].id : null;
    });
  };

  return (
    <div className="h-full flex bg-[#0c0c0c] text-[#e4e4e7] font-sans">
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        onSelectSession={setActiveId}
        onCloseSession={handleCloseSession}
        onNewTab={() => setShowPicker(true)}
      />

      {/* Terminal pane */}
      <div className="flex-1 relative">
        {sessions.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-white/20 text-sm">
            Open a tab to get started
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify sidebar renders**

Run: `cd client && pnpm dev`
Expected: Sidebar renders with "+ New tab" button. No sessions shown yet (functional wiring comes later).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/TabItem.tsx client/src/components/Sidebar.tsx client/src/App.tsx
git commit -m "feat(client): add Sidebar and TabItem components"
```

---

### Task 8: Client — TerminalPane + useSession

**Files:**
- Create: `client/src/hooks/useSession.ts`
- Create: `client/src/components/TerminalPane.tsx`

- [ ] **Step 1: Create `client/src/hooks/useSession.ts`**

```ts
import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

export function useSession(
  sessionId: string,
  containerRef: React.RefObject<HTMLDivElement | null>,
  isActive: boolean,
) {
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Create terminal and WebSocket on mount
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
      theme: {
        background: '#0c0c0c',
        foreground: '#e4e4e7',
        cursor: '#60a5fa',
      },
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/${sessionId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      const { cols, rows } = terminal;
      ws.send(JSON.stringify({ type: 'resize', cols, rows }));
    };

    ws.onmessage = (event) => {
      terminal.write(event.data);
    };

    terminal.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    // Resize observer
    const observer = new ResizeObserver(() => {
      fitAddon.fit();
      if (ws.readyState === WebSocket.OPEN) {
        const { cols, rows } = terminal;
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      ws.close();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      wsRef.current = null;
    };
  }, [sessionId]);

  // Focus and fit when becoming active
  useEffect(() => {
    if (isActive && terminalRef.current && fitAddonRef.current) {
      terminalRef.current.focus();
      fitAddonRef.current.fit();
    }
  }, [isActive]);
}
```

- [ ] **Step 2: Create `client/src/components/TerminalPane.tsx`**

```tsx
import { useRef } from 'react';
import type { Session } from '../types';
import { useSession } from '../hooks/useSession';

interface TerminalPaneProps {
  session: Session;
  isActive: boolean;
}

export default function TerminalPane({ session, isActive }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useSession(session.id, containerRef, isActive);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 ${isActive ? '' : 'invisible'}`}
    />
  );
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd client && pnpm exec tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add client/src/hooks/useSession.ts client/src/components/TerminalPane.tsx
git commit -m "feat(client): add TerminalPane with xterm.js and WebSocket hook"
```

---

### Task 9: Client — DirectoryPicker

**Files:**
- Create: `client/src/components/DirectoryPicker.tsx`

- [ ] **Step 1: Create `client/src/components/DirectoryPicker.tsx`**

```tsx
import { useState, useEffect, useRef } from 'react';

interface DirectoryPickerProps {
  onConfirm: (directory: string) => void;
  onCancel: () => void;
}

export default function DirectoryPicker({ onConfirm, onCancel }: DirectoryPickerProps) {
  const [input, setInput] = useState('~/');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!input) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    fetch(`/api/directories?prefix=${encodeURIComponent(input)}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((dirs: string[]) => {
        setSuggestions(dirs);
        setSelectedIndex(0);
      })
      .catch(() => {});

    return () => controller.abort();
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'Enter') {
      onConfirm(input);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setInput(suggestions[selectedIndex] + '/');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    }
  };

  return (
    <div className="absolute inset-0 bg-black/60 flex items-start justify-center pt-[20vh] z-10" onClick={onCancel}>
      <div
        className="bg-[#1a1a1a] border border-white/10 rounded-xl w-[500px] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4">
          <label className="text-sm text-white/50 mb-2 block">Directory path</label>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white/90 outline-none focus:border-blue-400/50 font-mono"
            placeholder="~/projects/my-app"
          />
        </div>

        {suggestions.length > 0 && (
          <div className="border-t border-white/[0.06] max-h-60 overflow-y-auto">
            {suggestions.map((dir, i) => (
              <div
                key={dir}
                onClick={() => setInput(dir + '/')}
                className={`px-4 py-2 text-sm cursor-pointer font-mono ${
                  i === selectedIndex
                    ? 'bg-white/[0.07] text-white/90'
                    : 'text-white/40 hover:bg-white/[0.04]'
                }`}
              >
                {dir}
              </div>
            ))}
          </div>
        )}

        <div className="p-3 border-t border-white/[0.06] flex justify-between text-[11px] text-white/25">
          <span>Tab: accept · Enter: confirm · Esc: cancel</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd client && pnpm exec tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add client/src/components/DirectoryPicker.tsx
git commit -m "feat(client): add DirectoryPicker modal with autocomplete"
```

---

### Task 10: Integration — App Wiring

**Files:**
- Modify: `client/src/App.tsx` (wire everything together)

- [ ] **Step 1: Update `client/src/App.tsx` with full wiring**

```tsx
import { useState } from 'react';
import type { Session } from './types';
import Sidebar from './components/Sidebar';
import TerminalPane from './components/TerminalPane';
import DirectoryPicker from './components/DirectoryPicker';

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const handleNewSession = async (directory: string) => {
    setShowPicker(false);
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory }),
    });
    if (!res.ok) return;
    const session: Session = await res.json();
    setSessions((prev) => [...prev, session]);
    setActiveId(session.id);
  };

  const handleCloseSession = async (id: string) => {
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== id);
      if (activeId === id) {
        setActiveId(remaining.length > 0 ? remaining[0].id : null);
      }
      return remaining;
    });
  };

  return (
    <div className="h-full flex bg-[#0c0c0c] text-[#e4e4e7] font-sans">
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        onSelectSession={setActiveId}
        onCloseSession={handleCloseSession}
        onNewTab={() => setShowPicker(true)}
      />

      <div className="flex-1 relative">
        {sessions.length === 0 && !showPicker && (
          <div className="absolute inset-0 flex items-center justify-center text-white/20 text-sm">
            Open a tab to get started
          </div>
        )}

        {sessions.map((session) => (
          <TerminalPane
            key={session.id}
            session={session}
            isActive={session.id === activeId}
          />
        ))}

        {showPicker && (
          <DirectoryPicker
            onConfirm={handleNewSession}
            onCancel={() => setShowPicker(false)}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd client && pnpm exec tsc --noEmit`
Expected: no errors

- [ ] **Step 3: End-to-end manual verification**

Start both servers:
```bash
# Terminal 1
cd server && pnpm dev

# Terminal 2
cd client && pnpm dev
```

Open http://localhost:5173 in browser.

Verify:
1. Empty sidebar with "+ New tab" button and "Open a tab to get started" message
2. Click "+ New tab" → directory picker modal appears with `~/` prefilled
3. Type a path — autocomplete suggestions appear below
4. Tab accepts top suggestion, arrow keys navigate
5. Press Enter — modal closes, new tab appears in sidebar, terminal shows shell
6. Type commands in the terminal (ls, echo hello, etc.) — they work
7. Click "+ New tab" again, add a second tab
8. Click between tabs in sidebar — terminal switches
9. Click × on a tab — it closes, terminal is removed
10. Close last tab — back to empty state

- [ ] **Step 4: Commit**

```bash
git add client/src/App.tsx
git commit -m "feat(client): wire App with sessions, terminals, and directory picker"
```
