import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { watch, type FSWatcher } from 'node:fs';
import { join } from 'node:path';

import { type IPty, type IDisposable } from 'node-pty';

import { createPty, killPty } from './pty-manager.js';

const SCROLLBACK_LIMIT = 100 * 1024; // 100KB

export interface Session {
  id: string;
  directory: string;
  branch: string;
  parentId?: string;
  pty: IPty;
  scrollback: string;
  scrollbackDisposable: IDisposable;
}

const sessions = new Map<string, Session>();
const branchWatchers = new Map<string, FSWatcher>();
let branchChangeHandler: ((sessionId: string, branch: string) => void) | null = null;

export function onBranchChange(handler: (sessionId: string, branch: string) => void): void {
  branchChangeHandler = handler;
}

export function createSession(directory: string, shell: string): Session {
  const pty = createPty(shell, directory, 80, 24);
  const session: Session = {
    id: randomUUID(),
    directory,
    branch: getGitBranch(directory),
    pty,
    scrollback: '',
    scrollbackDisposable: null!,
  };
  session.scrollbackDisposable = pty.onData((data: string) => {
    session.scrollback += data;
    if (session.scrollback.length > SCROLLBACK_LIMIT) {
      session.scrollback = session.scrollback.slice(-SCROLLBACK_LIMIT);
    }
  });
  // Clean up zombie sessions when PTY exits without an active WebSocket
  pty.onExit(() => {
    sessions.delete(session.id);
    session.scrollbackDisposable.dispose();
  });
  sessions.set(session.id, session);

  // Watch .git/HEAD for branch changes (debounced — fs.watch can fire multiple times per change)
  try {
    const gitRoot = execSync('git rev-parse --show-toplevel', {
      cwd: directory,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    const gitDir = join(gitRoot, '.git');
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const watcher = watch(gitDir, (_event, filename) => {
      if (filename && filename !== 'HEAD') return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const newBranch = getGitBranch(session.directory);
        if (newBranch !== session.branch) {
          session.branch = newBranch;
          branchChangeHandler?.(session.id, newBranch);
        }
      }, 100);
    });
    branchWatchers.set(session.id, watcher);
  } catch {
    // Not a git repo or .git/HEAD not accessible
  }

  return session;
}

export function createAuxSession(parentId: string, shell: string): Session {
  const parent = sessions.get(parentId);
  if (!parent) throw new Error('parent session not found');
  const pty = createPty(shell, parent.directory, 80, 24);
  const session: Session = {
    id: randomUUID(),
    directory: parent.directory,
    branch: parent.branch,
    parentId,
    pty,
    scrollback: '',
    scrollbackDisposable: null!,
  };
  session.scrollbackDisposable = pty.onData((data: string) => {
    session.scrollback += data;
    if (session.scrollback.length > SCROLLBACK_LIMIT) {
      session.scrollback = session.scrollback.slice(-SCROLLBACK_LIMIT);
    }
  });
  pty.onExit(() => {
    sessions.delete(session.id);
    session.scrollbackDisposable.dispose();
  });
  sessions.set(session.id, session);
  return session;
}

export function getAuxSession(parentId: string): Session | undefined {
  for (const session of sessions.values()) {
    if (session.parentId === parentId) return session;
  }
  return undefined;
}

export function getAllPrimarySessions(): Session[] {
  return Array.from(sessions.values()).filter((s) => !s.parentId);
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
  // Cascade: delete aux child
  for (const [childId, child] of sessions) {
    if (child.parentId === id) {
      child.scrollbackDisposable.dispose();
      killPty(child.pty);
      sessions.delete(childId);
      break;
    }
  }
  branchWatchers.get(id)?.close();
  branchWatchers.delete(id);
  session.scrollbackDisposable.dispose();
  killPty(session.pty);
  sessions.delete(id);
}

export function killAllSessions(): void {
  for (const watcher of branchWatchers.values()) watcher.close();
  branchWatchers.clear();
  for (const session of sessions.values()) {
    session.scrollbackDisposable.dispose();
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
