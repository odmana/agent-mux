import { describe, it, expect } from 'vitest';
import { listDirectories } from '../src/routes.js';

const home = (process.env.HOME || '/tmp').replaceAll('\\', '/');

describe('listDirectories', () => {
  it('lists subdirectories for a trailing slash path', () => {
    const dirs = listDirectories('/tmp/');
    expect(Array.isArray(dirs)).toBe(true);
    for (const dir of dirs) {
      expect(dir).toHaveProperty('path');
      expect(dir).toHaveProperty('matchIndices');
    }
  });

  it('returns empty matchIndices for trailing slash listing', () => {
    const dirs = listDirectories(home + '/');
    expect(dirs.length).toBeGreaterThan(0);
    for (const dir of dirs) {
      expect(dir.matchIndices).toEqual([]);
    }
  });

  it('filters by prefix', () => {
    const dirs = listDirectories(home + '/');
    expect(dirs.length).toBeGreaterThan(0);
    for (const dir of dirs) {
      expect(dir.path.startsWith(home + '/')).toBe(true);
    }
  });

  it('expands tilde to home directory', () => {
    const dirs = listDirectories('~/');
    expect(dirs.length).toBeGreaterThan(0);
    for (const dir of dirs) {
      expect(dir.path.startsWith(home + '/')).toBe(true);
    }
  });

  it('returns empty array for nonexistent path', () => {
    const dirs = listDirectories('/nonexistent/path/xyz/');
    expect(dirs).toEqual([]);
  });

  it('filters hidden directories', () => {
    const dirs = listDirectories(home + '/');
    for (const dir of dirs) {
      const name = dir.path.split('/').pop()!;
      expect(name.startsWith('.')).toBe(false);
    }
  });

  it('matches partial directory names via fuzzy match', () => {
    const allDirs = listDirectories(home + '/');
    if (allDirs.length > 0) {
      const firstName = allDirs[0].path.split('/').pop()!;
      const partial = firstName.slice(0, 2);
      const matched = listDirectories(home + '/' + partial);
      expect(matched.length).toBeGreaterThan(0);
      // The first result should be a prefix match
      const topName = matched[0].path.split('/').pop()!.toLowerCase();
      expect(topName.startsWith(partial.toLowerCase())).toBe(true);
    }
  });

  it('returns matchIndices for partial matches', () => {
    const allDirs = listDirectories(home + '/');
    if (allDirs.length > 0) {
      const firstName = allDirs[0].path.split('/').pop()!;
      const partial = firstName.slice(0, 2);
      const matched = listDirectories(home + '/' + partial);
      expect(matched.length).toBeGreaterThan(0);
      expect(matched[0].matchIndices.length).toBe(partial.length);
    }
  });

  it('returns empty for empty prefix', () => {
    const dirs = listDirectories('');
    expect(dirs).toEqual([]);
  });
});
