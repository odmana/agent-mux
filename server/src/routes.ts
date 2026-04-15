import { readdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, dirname, basename } from 'node:path';

import { Router } from 'express';

import { fuzzyMatch } from './fuzzy-match.js';
import { checkHooksStatus, installHooks } from './hooks-setup.js';
import { clearSessionState } from './notification-watcher.js';
import {
  createSession,
  createAuxSession,
  getAuxSession,
  getAllPrimarySessions,
  getSession,
  deleteSession,
} from './sessions.js';

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
    const matched: { path: string; score: number; matchIndices: number[] }[] = [];
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
    return matched.slice(0, 20).map(({ path, matchIndices }) => ({ path, matchIndices }));
  } catch {
    return [];
  }
}

export function createRouter(
  shell: string,
  initialCommand?: string,
  auxInitialCommand?: string,
): Router {
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
    const session = createSession(expanded, shell, initialCommand);
    res.status(201).json({
      id: session.id,
      directory: session.directory,
      branch: session.branch,
    });
  });

  router.post('/api/sessions/:id/aux', (req, res) => {
    const parent = getSession(req.params.id);
    if (!parent) {
      res.status(404).json({ error: 'parent session not found' });
      return;
    }
    if (parent.parentId) {
      res.status(400).json({ error: 'cannot create aux for an aux session' });
      return;
    }
    const existing = getAuxSession(req.params.id);
    if (existing) {
      res.json({ id: existing.id, directory: existing.directory, branch: existing.branch });
      return;
    }
    const aux = createAuxSession(req.params.id, shell, auxInitialCommand);
    res.status(201).json({ id: aux.id, directory: aux.directory, branch: aux.branch });
  });

  router.get('/api/sessions', (_req, res) => {
    const sessions = getAllPrimarySessions().map((s) => {
      const aux = getAuxSession(s.id);
      const entry: { id: string; directory: string; branch: string; auxId?: string } = {
        id: s.id,
        directory: s.directory,
        branch: s.branch,
      };
      if (aux) entry.auxId = aux.id;
      return entry;
    });
    res.json(sessions);
  });

  router.delete('/api/sessions/:id', (req, res) => {
    if (!getSession(req.params.id)) {
      res.status(404).json({ error: 'session not found' });
      return;
    }
    const aux = getAuxSession(req.params.id);
    if (aux) clearSessionState(aux.id);
    clearSessionState(req.params.id);
    deleteSession(req.params.id);
    res.status(204).end();
  });

  router.get('/api/directories', (req, res) => {
    const prefix = (req.query.prefix as string) || '';
    res.json(listDirectories(prefix));
  });

  router.get('/api/hooks/status', (_req, res) => {
    res.json(checkHooksStatus());
  });

  router.post('/api/hooks/install', (_req, res) => {
    const result = installHooks();
    res.status(result.success ? 200 : 500).json(result);
  });

  return router;
}
