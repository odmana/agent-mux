import { Router } from 'express';
import { readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { homedir } from 'node:os';
import {
  createSession,
  getAllSessions,
  getSession,
  deleteSession,
} from './sessions.js';
import { fuzzyMatch } from './fuzzy-match.js';

export interface DirectorySuggestion {
  path: string;
  matchIndices: number[];
}

function expandTilde(path: string): string {
  const expanded = path.startsWith('~') ? homedir() + path.slice(1) : path;
  return expanded.replaceAll('\\', '/');
}

export function listDirectories(prefix: string): DirectorySuggestion[] {
  if (!prefix) return [];

  const expanded = expandTilde(prefix);

  try {
    if (expanded.endsWith('/')) {
      const entries = readdirSync(expanded, { withFileTypes: true });
      return entries
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
        .map((e) => ({ path: expanded + e.name, matchIndices: [] }))
        .slice(0, 20);
    }

    const parent = dirname(expanded);
    const partial = basename(expanded);
    const entries = readdirSync(parent, { withFileTypes: true });
    const matched: { path: string; score: number; matchIndices: number[] }[] =
      [];
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('.')) continue;
      const result = fuzzyMatch(partial, e.name);
      if (result) {
        matched.push({
          path: resolve(parent, e.name).replaceAll('\\', '/'),
          score: result.score,
          matchIndices: result.matchIndices,
        });
      }
    }
    matched.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.path.localeCompare(b.path);
    });
    return matched
      .slice(0, 20)
      .map(({ path, matchIndices }) => ({ path, matchIndices }));
  } catch {
    return [];
  }
}

export function createRouter(shell: string): Router {
  const router = Router();

  router.post('/api/sessions', (req, res) => {
    const { directory } = req.body;
    if (!directory || typeof directory !== 'string') {
      res.status(400).json({ error: 'directory is required' });
      return;
    }
    const expanded = expandTilde(directory);
    if (!existsSync(expanded)) {
      res.status(400).json({ error: 'directory does not exist' });
      return;
    }
    const session = createSession(expanded, shell);
    res.status(201).json({
      id: session.id,
      directory: session.directory,
      branch: session.branch,
    });
  });

  router.get('/api/sessions', (_req, res) => {
    const sessions = getAllSessions().map((s) => ({
      id: s.id,
      directory: s.directory,
      branch: s.branch,
    }));
    res.json(sessions);
  });

  router.delete('/api/sessions/:id', (req, res) => {
    if (!getSession(req.params.id)) {
      res.status(404).json({ error: 'session not found' });
      return;
    }
    deleteSession(req.params.id);
    res.status(204).end();
  });

  router.get('/api/directories', (req, res) => {
    const prefix = (req.query.prefix as string) || '';
    res.json(listDirectories(prefix));
  });

  return router;
}
