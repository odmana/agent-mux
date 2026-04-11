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
