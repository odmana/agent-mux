import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import * as v from 'valibot';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';

import { ConfigSchema, loadConfig, watchConfig } from '../src/config.js';

describe('loadConfig', () => {
  // Must match the path loadConfig() resolves: import.meta.dirname (server/src) + ../../config.json
  const configPath = resolve(import.meta.dirname, '../../config.json');
  let originalContent: string | null = null;

  beforeEach(() => {
    // Preserve existing config.json if present
    if (existsSync(configPath)) {
      originalContent = readFileSync(configPath, 'utf-8');
      unlinkSync(configPath);
    }
  });

  afterEach(() => {
    if (existsSync(configPath)) unlinkSync(configPath);
    // Restore original config.json
    if (originalContent !== null) {
      writeFileSync(configPath, originalContent);
      originalContent = null;
    }
  });

  it('returns defaults when no config.json exists', () => {
    const config = loadConfig();
    expect(config.serverPort).toBe(3000);
    expect(typeof config.shell).toBe('string');
    expect(config.shell.length).toBeGreaterThan(0);
  });

  it('reads shell from config.json', () => {
    writeFileSync(configPath, JSON.stringify({ shell: '/bin/bash' }));
    const config = loadConfig();
    expect(config.shell).toBe('/bin/bash');
  });

  it('reads port from config.json', () => {
    writeFileSync(configPath, JSON.stringify({ serverPort: 4000 }));
    const config = loadConfig();
    expect(config.serverPort).toBe(4000);
  });

  it('uses defaults for missing fields', () => {
    writeFileSync(configPath, JSON.stringify({}));
    const config = loadConfig();
    expect(config.serverPort).toBe(3000);
    expect(typeof config.shell).toBe('string');
  });

  it('handles invalid JSON gracefully', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    writeFileSync(configPath, 'not json');
    const config = loadConfig();
    expect(config.serverPort).toBe(3000);
    warn.mockRestore();
  });

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

  it('falls back to defaults when config fails schema validation', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    writeFileSync(configPath, JSON.stringify({ playbooks: 'not an array' }));
    const config = loadConfig();
    expect(config.playbooks).toBeUndefined();
    expect(config.serverPort).toBe(3000);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('ConfigSchema', () => {
  it('rejects ports outside 1-65535', () => {
    const low = v.safeParse(ConfigSchema, { serverPort: 0 });
    expect(low.success).toBe(false);
    const high = v.safeParse(ConfigSchema, { serverPort: 70000 });
    expect(high.success).toBe(false);
  });

  it('rejects non-integer ports', () => {
    const result = v.safeParse(ConfigSchema, { serverPort: 3000.5 });
    expect(result.success).toBe(false);
  });

  it('rejects playbooks with empty commands array', () => {
    const result = v.safeParse(ConfigSchema, {
      playbooks: [{ name: 'Dev', commands: [] }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects playbooks missing a name', () => {
    const result = v.safeParse(ConfigSchema, {
      playbooks: [{ name: '', commands: [{ label: 'x', command: 'y' }] }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects playbook commands with empty label or command', () => {
    const missingCommand = v.safeParse(ConfigSchema, {
      playbooks: [{ name: 'Dev', commands: [{ label: 'API', command: '' }] }],
    });
    expect(missingCommand.success).toBe(false);
  });

  it('accepts a fully-populated valid config', () => {
    const result = v.safeParse(ConfigSchema, {
      shell: '/bin/bash',
      serverPort: 4000,
      clientPort: 4001,
      initialCommand: 'claude',
      auxInitialCommand: 'lazygit',
      defaultDirectory: '~/projects/',
      playbooks: [{ name: 'Dev', commands: [{ label: 'API', command: 'npm run api' }] }],
    });
    expect(result.success).toBe(true);
  });
});

describe('watchConfig', () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'agent-mux-config-'));
    configPath = join(tempDir, 'config.json');
    writeFileSync(configPath, JSON.stringify({ serverPort: 4000 }));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('fires onChange with the reloaded config when the file changes', async () => {
    const updates: { serverPort: number; playbooks?: unknown }[] = [];
    const watcher = watchConfig(
      configPath,
      (next) => {
        updates.push({ serverPort: next.serverPort, playbooks: next.playbooks });
      },
      { debounceMs: 20 },
    );

    try {
      writeFileSync(
        configPath,
        JSON.stringify({
          serverPort: 4000,
          playbooks: [{ name: 'Dev', commands: [{ label: 'API', command: 'npm run api' }] }],
        }),
      );

      await vi.waitFor(
        () => {
          expect(updates.length).toBeGreaterThan(0);
        },
        { timeout: 2000 },
      );

      const last = updates[updates.length - 1];
      expect(last.serverPort).toBe(4000);
      expect((last.playbooks as { name: string }[] | undefined)?.[0]?.name).toBe('Dev');
    } finally {
      watcher.dispose();
    }
  });

  it('does not fire onChange when the file is rewritten with identical content', async () => {
    const onChange = vi.fn();
    const watcher = watchConfig(configPath, onChange, { debounceMs: 20 });

    try {
      writeFileSync(configPath, JSON.stringify({ serverPort: 4000 }));
      await new Promise((r) => setTimeout(r, 120));
      expect(onChange).not.toHaveBeenCalled();
    } finally {
      watcher.dispose();
    }
  });
});
