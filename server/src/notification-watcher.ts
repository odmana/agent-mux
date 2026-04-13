import { readdirSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { getAllSessions } from './sessions.js';

export type NotificationState = 'none' | 'idle' | 'permission' | 'working';

interface WatcherOptions {
  onStateChange: (sessionId: string, state: NotificationState) => void;
}

const TMP_DIR = tmpdir();
const FILE_PATTERN = /^agent-mux-(\d+)\.state$/;
const POLL_INTERVAL_MS = 500;
const STALE_FILE_MAX_AGE_MS = 60_000; // Delete unmatched files older than 60s

let pollTimer: ReturnType<typeof setInterval> | null = null;
let onStateChange: WatcherOptions['onStateChange'] | null = null;

// Current notification state per session
const states = new Map<string, NotificationState>();

/**
 * Normalize a path for cross-platform comparison.
 * Handles MSYS-style paths (/c/Users/...) vs Windows paths (C:\Users\...).
 */
function normalizePath(p: string): string {
  let normalized = p.replace(/\/+$/, '').replace(/\\+$/, '');
  // Convert backslashes to forward slashes
  normalized = normalized.replace(/\\/g, '/');
  // Convert MSYS-style /c/... to C:/...
  normalized = normalized.replace(
    /^\/([a-zA-Z])\//,
    (_, drive: string) => `${drive.toUpperCase()}:/`,
  );
  // Uppercase drive letter for consistent comparison
  normalized = normalized.replace(/^([a-zA-Z]):/, (_, drive: string) => `${drive.toUpperCase()}:`);
  return normalized;
}

function parseStateFile(
  filePath: string,
): { event: 'idle' | 'permission' | 'working'; directory: string } | null {
  try {
    const content = readFileSync(filePath, 'utf-8').trim();
    const spaceIndex = content.indexOf(' ');
    if (spaceIndex <= 0) return null;

    const eventStr = content.substring(0, spaceIndex);
    const directory = content.substring(spaceIndex + 1);

    if (eventStr === 'idle' || eventStr === 'idle_prompt') {
      return { event: 'idle', directory: normalizePath(directory) };
    }
    if (eventStr === 'permission' || eventStr === 'permission_prompt') {
      return { event: 'permission', directory: normalizePath(directory) };
    }
    if (eventStr === 'working') {
      return { event: 'working', directory: normalizePath(directory) };
    }

    return null;
  } catch {
    return null;
  }
}

function matchSessionByDirectory(directory: string): string | null {
  const sessions = getAllSessions();
  const normalized = normalizePath(directory);
  const match = sessions.find((s) => normalizePath(s.directory) === normalized);
  return match?.id ?? null;
}

interface StateFileEntry {
  filePath: string;
  event: 'idle' | 'permission' | 'working';
  sessionId: string;
  mtime: number;
}

function poll(): void {
  let files: string[];
  try {
    files = readdirSync(TMP_DIR).filter((f) => FILE_PATTERN.test(f));
  } catch {
    return;
  }

  // Parse all state files and match to sessions
  const entries: StateFileEntry[] = [];
  const filesToDelete: string[] = [];

  for (const file of files) {
    const filePath = resolve(TMP_DIR, file);
    const parsed = parseStateFile(filePath);
    if (!parsed) {
      // Unreadable or unparseable — delete stale file
      filesToDelete.push(filePath);
      continue;
    }

    const sessionId = matchSessionByDirectory(parsed.directory);
    if (!sessionId) {
      // No matching session — delete if process is dead or file is old
      let isStale = false;
      try {
        const age = Date.now() - statSync(filePath).mtimeMs;
        if (age > STALE_FILE_MAX_AGE_MS) isStale = true;
      } catch {
        isStale = true;
      }
      if (!isStale) {
        const pidMatch = file.match(FILE_PATTERN);
        if (pidMatch) {
          try {
            process.kill(Number(pidMatch[1]), 0);
          } catch {
            isStale = true;
          }
        }
      }
      if (isStale) filesToDelete.push(filePath);
      continue;
    }

    let mtime = 0;
    try {
      mtime = statSync(filePath).mtimeMs;
    } catch {
      // ignore
    }

    entries.push({ filePath, event: parsed.event, sessionId, mtime });
    filesToDelete.push(filePath);
  }

  // Group by session, pick newest per session
  const bySession = new Map<string, StateFileEntry>();
  for (const entry of entries) {
    const existing = bySession.get(entry.sessionId);
    if (!existing || entry.mtime > existing.mtime) {
      bySession.set(entry.sessionId, entry);
    }
  }

  // Emit state changes
  for (const [sessionId, entry] of bySession) {
    const current = states.get(sessionId) ?? 'none';
    if (current !== entry.event) {
      states.set(sessionId, entry.event);
      onStateChange?.(sessionId, entry.event);
    }
  }

  // Clean up processed files
  for (const filePath of filesToDelete) {
    try {
      unlinkSync(filePath);
    } catch {
      // ignore — file may already be gone
    }
  }
}

export function startNotificationWatcher(opts: WatcherOptions): void {
  if (pollTimer) stopNotificationWatcher();
  onStateChange = opts.onStateChange;

  // One-time cleanup of stale files on startup
  poll();

  pollTimer = setInterval(poll, POLL_INTERVAL_MS);
}

export function stopNotificationWatcher(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  onStateChange = null;
  states.clear();
}

/**
 * Clear notification state for a session if it's currently 'permission'.
 * Called when PTY produces output, indicating the permission was granted.
 */
export function clearIfPermission(sessionId: string): void {
  if (states.get(sessionId) === 'permission') {
    states.set(sessionId, 'working');
    onStateChange?.(sessionId, 'working');
  }
}
