import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  const configPath = 'config.json';

  afterEach(() => {
    if (existsSync(configPath)) unlinkSync(configPath);
  });

  it('returns defaults when no config.json exists', () => {
    const config = loadConfig();
    expect(config.port).toBe(3000);
    expect(typeof config.shell).toBe('string');
    expect(config.shell.length).toBeGreaterThan(0);
  });

  it('reads shell from config.json', () => {
    writeFileSync(configPath, JSON.stringify({ shell: '/bin/bash' }));
    const config = loadConfig();
    expect(config.shell).toBe('/bin/bash');
  });

  it('reads port from config.json', () => {
    writeFileSync(configPath, JSON.stringify({ port: 4000 }));
    const config = loadConfig();
    expect(config.port).toBe(4000);
  });

  it('uses defaults for missing fields', () => {
    writeFileSync(configPath, JSON.stringify({}));
    const config = loadConfig();
    expect(config.port).toBe(3000);
    expect(typeof config.shell).toBe('string');
  });

  it('handles invalid JSON gracefully', () => {
    writeFileSync(configPath, 'not json');
    const config = loadConfig();
    expect(config.port).toBe(3000);
  });
});
