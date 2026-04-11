import { Router } from 'express';
import { readdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import {
  createSession,
  getAllSessions,
  getSession,
  deleteSession,
} from './sessions.js';

export function listDirectories(prefix: string): string[] {
  if (!prefix) return [];

  const expanded = prefix.startsWith('~')
    ? homedir() + prefix.slice(1)
    : prefix;

  try {
    if (expanded.endsWith('/')) {
      const entries = readdirSync(expanded, { withFileTypes: true });
      return entries
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
        .map((e) => expanded + e.name)
        .slice(0, 20);
    }

    const parent = dirname(expanded);
    const partial = basename(expanded).toLowerCase();
    const entries = readdirSync(parent, { withFileTypes: true });
    return entries
      .filter(
        (e) =>
          e.isDirectory() &&
          !e.name.startsWith('.') &&
          e.name.toLowerCase().startsWith(partial),
      )
      .map((e) => resolve(parent, e.name))
      .slice(0, 20);
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
    if (!existsSync(directory)) {
      res.status(400).json({ error: 'directory does not exist' });
      return;
    }
    const session = createSession(directory, shell);
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
