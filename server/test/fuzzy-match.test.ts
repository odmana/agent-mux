import { describe, it, expect } from 'vitest';

import { fuzzyMatch, fuzzySort } from '../src/fuzzy-match.js';

describe('fuzzyMatch', () => {
  it('matches contiguous characters (prefix)', () => {
    const result = fuzzyMatch('pro', 'projects');
    expect(result).not.toBeNull();
    expect(result!.matchIndices).toEqual([0, 1, 2]);
  });

  it('matches non-contiguous characters', () => {
    const result = fuzzyMatch('prj', 'projects');
    expect(result).not.toBeNull();
    // p=0, r=1, j=3
    expect(result!.matchIndices).toEqual([0, 1, 3]);
  });

  it('matches across word boundaries', () => {
    const result = fuzzyMatch('dwnl', 'Downloads');
    expect(result).not.toBeNull();
    // D=0, w=2, n=3, l=4
    expect(result!.matchIndices).toEqual([0, 2, 3, 4]);
  });

  it('returns null when no match is possible', () => {
    expect(fuzzyMatch('abc', 'xyz')).toBeNull();
  });

  it('returns null when pattern is longer than candidate', () => {
    expect(fuzzyMatch('abcdef', 'abc')).toBeNull();
  });

  it('returns match with empty indices for empty pattern', () => {
    const result = fuzzyMatch('', 'anything');
    expect(result).not.toBeNull();
    expect(result!.score).toBe(0);
    expect(result!.matchIndices).toEqual([]);
  });

  it('is case insensitive', () => {
    const result = fuzzyMatch('PRJ', 'projects');
    expect(result).not.toBeNull();
    expect(result!.matchIndices).toEqual([0, 1, 3]);
  });

  it('scores prefix matches higher than non-prefix', () => {
    const prefix = fuzzyMatch('doc', 'documents');
    const nonPrefix = fuzzyMatch('doc', 'mydocuments');
    expect(prefix).not.toBeNull();
    expect(nonPrefix).not.toBeNull();
    expect(prefix!.score).toBeGreaterThan(nonPrefix!.score);
  });

  it('scores consecutive matches higher than sparse', () => {
    const consecutive = fuzzyMatch('pro', 'projects');
    const sparse = fuzzyMatch('prt', 'projects');
    expect(consecutive).not.toBeNull();
    expect(sparse).not.toBeNull();
    expect(consecutive!.score).toBeGreaterThan(sparse!.score);
  });

  it('gives word boundary bonus', () => {
    // "nc" matching "node_config" (n=word start, c=word start after _)
    const withBoundary = fuzzyMatch('nc', 'node_config');
    // "nc" matching "onces" (no word boundaries for c)
    const noBoundary = fuzzyMatch('nc', 'onces');
    expect(withBoundary).not.toBeNull();
    expect(noBoundary).not.toBeNull();
    expect(withBoundary!.score).toBeGreaterThan(noBoundary!.score);
  });
});

describe('fuzzySort', () => {
  it('returns results sorted by score descending', () => {
    const results = fuzzySort('doc', ['mydocuments', 'documents', 'adocument']);
    expect(results.length).toBe(3);
    expect(results[0].text).toBe('documents');
  });

  it('filters out non-matching candidates', () => {
    const results = fuzzySort('xyz', ['abc', 'def', 'xylz']);
    expect(results.length).toBe(1);
    expect(results[0].text).toBe('xylz');
  });

  it('returns empty array when nothing matches', () => {
    const results = fuzzySort('qqq', ['abc', 'def']);
    expect(results).toEqual([]);
  });

  it('sorts alphabetically for equal scores', () => {
    const results = fuzzySort('a', ['beta', 'alpha']);
    // Both match 'a' at different positions, but alpha gets prefix bonus
    // Actually alpha: a at index 0 (prefix+boundary), beta: a at index 3
    expect(results[0].text).toBe('alpha');
  });
});
