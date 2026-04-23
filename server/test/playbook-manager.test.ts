import { describe, it, expect, afterAll } from 'vitest';

import {
  startPlaybook,
  stopPlaybook,
  getPlaybookState,
  stopAllPlaybooks,
} from '../src/playbook-manager.js';

describe.concurrent('playbook-manager', () => {
  // Safety net in case a test throws before its finally block runs.
  afterAll(async () => {
    await stopAllPlaybooks();
  });

  it('starts a playbook and collects output', async () => {
    const sessionId = 'session-1';
    try {
      const logs: { source: string; text: string }[] = [];
      await startPlaybook(
        sessionId,
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
    } finally {
      await stopPlaybook(sessionId);
    }
  });

  it('getPlaybookState returns null for unknown session', () => {
    expect(getPlaybookState('nonexistent')).toBeNull();
  });

  it('stopPlaybook stops running commands', async () => {
    const sessionId = 'session-2';
    try {
      await startPlaybook(
        sessionId,
        {
          name: 'Long',
          commands: [{ label: 'Sleep', command: 'sleep 60' }],
        },
        '/tmp',
        () => {},
        () => {},
      );
      const state = getPlaybookState(sessionId);
      expect(state).not.toBeNull();
      expect(state!.commands[0].status).toBe('running');
      await stopPlaybook(sessionId);
      expect(getPlaybookState(sessionId)).toBeNull();
    } finally {
      await stopPlaybook(sessionId);
    }
  });

  it('starting a new playbook stops the previous one', async () => {
    const sessionId = 'session-3';
    try {
      await startPlaybook(
        sessionId,
        {
          name: 'First',
          commands: [{ label: 'Sleep', command: 'sleep 60' }],
        },
        '/tmp',
        () => {},
        () => {},
      );
      await startPlaybook(
        sessionId,
        {
          name: 'Second',
          commands: [{ label: 'Echo', command: 'echo replaced' }],
        },
        '/tmp',
        () => {},
        () => {},
      );
      const state = getPlaybookState(sessionId);
      expect(state?.name).toBe('Second');
    } finally {
      await stopPlaybook(sessionId);
    }
  });

  it('stop followed by a quick start does not clobber the new run', async () => {
    // Regression: the old run's result-rejection used to delete the map entry
    // unconditionally, wiping out the new run that had just replaced it —
    // leaving the new run's processes orphaned with no way to stop them.
    const sessionId = 'session-4';
    try {
      await startPlaybook(
        sessionId,
        {
          name: 'First',
          commands: [{ label: 'Sleep', command: 'sleep 60' }],
        },
        '/tmp',
        () => {},
        () => {},
      );
      // Fire stop without awaiting, then immediately start — mirrors the WS
      // handler's fire-and-forget pattern when a user clicks stop→start quickly.
      const stopping = stopPlaybook(sessionId);
      await startPlaybook(
        sessionId,
        {
          name: 'Second',
          commands: [{ label: 'Echo', command: 'echo replaced' }],
        },
        '/tmp',
        () => {},
        () => {},
      );
      await stopping;
      // Let the old run's result.catch microtask drain.
      await new Promise((resolve) => setTimeout(resolve, 10));
      const state = getPlaybookState(sessionId);
      expect(state?.name).toBe('Second');
    } finally {
      await stopPlaybook(sessionId);
    }
  });
});
