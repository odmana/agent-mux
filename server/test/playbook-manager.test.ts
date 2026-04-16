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
