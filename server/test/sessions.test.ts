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
