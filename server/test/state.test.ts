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
