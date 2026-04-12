import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from '../src/config.js';

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
    writeFileSync(configPath, 'not json');
    const config = loadConfig();
    expect(config.serverPort).toBe(3000);
  });
});
