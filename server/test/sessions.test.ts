import { describe, it, expect, beforeEach, vi, afterAll } from 'vitest';
import {
  createSession,
  getSession,
  getAllSessions,
  deleteSession,
  killAllSessions,
} from '../src/sessions.js';

vi.mock('../src/pty-manager.js', () => ({
  createPty: () => ({ pid: 1, onData: vi.fn(() => ({ dispose: vi.fn() })), onExit: vi.fn(() => ({ dispose: vi.fn() })), write: vi.fn(), resize: vi.fn(), kill: vi.fn() }),
  resizePty: vi.fn(),
  killPty: vi.fn(),
}));

describe('sessions', () => {
  beforeEach(() => {
    killAllSessions();
  });

  afterAll(() => {
    killAllSessions();
  });

  it('createSession adds a session', () => {
    const session = createSession('/tmp', '/bin/sh');
    expect(session.id).toBeTruthy();
    expect(session.directory).toBe('/tmp');
    expect(session.pty).toBeTruthy();
  });

  it('getSession retrieves by id', () => {
    const session = createSession('/tmp', '/bin/sh');
    const found = getSession(session.id);
    expect(found).toBe(session);
  });

  it('getSession returns undefined for unknown id', () => {
    expect(getSession('nonexistent')).toBeUndefined();
  });

  it('getAllSessions returns all sessions', () => {
    createSession('/tmp', '/bin/sh');
    createSession('/tmp', '/bin/sh');
    expect(getAllSessions()).toHaveLength(2);
  });

  it('deleteSession removes and kills PTY', () => {
    const session = createSession('/tmp', '/bin/sh');
    deleteSession(session.id);
    expect(getSession(session.id)).toBeUndefined();
    expect(getAllSessions()).toHaveLength(0);
  });

  it('killAllSessions clears everything', () => {
    createSession('/tmp', '/bin/sh');
    createSession('/tmp', '/bin/sh');
    killAllSessions();
    expect(getAllSessions()).toHaveLength(0);
  });
});
