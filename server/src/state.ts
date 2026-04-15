import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as v from 'valibot';

export const AppStateSchema = v.object({
  sidebarWidth: v.optional(v.pipe(v.number(), v.minValue(180), v.maxValue(400))),
});

export type AppState = v.InferOutput<typeof AppStateSchema>;

export function loadState(statePath?: string): AppState {
  statePath ??= resolve(import.meta.dirname, '../../state.json');
  if (!existsSync(statePath)) return {};

  try {
    const raw = JSON.parse(readFileSync(statePath, 'utf-8'));
    const result = v.safeParse(AppStateSchema, raw);
    return result.success ? result.output : {};
  } catch {
    return {};
  }
}

export function updateState(statePath?: string, partial?: Partial<AppState>): AppState {
  statePath ??= resolve(import.meta.dirname, '../../state.json');
  const existing = loadState(statePath);
  const merged = { ...existing, ...partial };
  const result = v.safeParse(AppStateSchema, merged);
  if (!result.success) return existing;
  writeFileSync(statePath, JSON.stringify(result.output, null, 2));
  return result.output;
}
