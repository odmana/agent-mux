import { describe, it, expect } from 'vitest';
import { listDirectories } from '../src/routes.js';

describe('listDirectories', () => {
  it('lists subdirectories for a trailing slash path', () => {
    const dirs = listDirectories('/tmp/');
    expect(Array.isArray(dirs)).toBe(true);
  });

  it('filters by prefix', () => {
    // The home directory should have some subdirectories
    const home = process.env.HOME || '/tmp';
    const dirs = listDirectories(home + '/');
    expect(dirs.length).toBeGreaterThan(0);
    for (const dir of dirs) {
      expect(dir.startsWith(home + '/')).toBe(true);
    }
  });

  it('expands tilde to home directory', () => {
    const dirs = listDirectories('~/');
    const home = process.env.HOME || '';
    expect(dirs.length).toBeGreaterThan(0);
    for (const dir of dirs) {
      expect(dir.startsWith(home + '/')).toBe(true);
    }
  });

  it('returns empty array for nonexistent path', () => {
    const dirs = listDirectories('/nonexistent/path/xyz/');
    expect(dirs).toEqual([]);
  });

  it('filters hidden directories', () => {
    const home = process.env.HOME || '/tmp';
    const dirs = listDirectories(home + '/');
    for (const dir of dirs) {
      const name = dir.split('/').pop()!;
      expect(name.startsWith('.')).toBe(false);
    }
  });

  it('returns empty for empty prefix', () => {
    const dirs = listDirectories('');
    expect(dirs).toEqual([]);
  });
});
