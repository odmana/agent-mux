import { readFileSync, existsSync, watch, type FSWatcher } from 'node:fs';
import { platform } from 'node:os';
import { resolve } from 'node:path';

import * as v from 'valibot';

const PortSchema = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(65535));

const PlaybookCommandSchema = v.object({
  label: v.pipe(v.string(), v.minLength(1)),
  command: v.pipe(v.string(), v.minLength(1)),
});

const PlaybookSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1)),
  commands: v.pipe(v.array(PlaybookCommandSchema), v.minLength(1)),
});

export const ConfigSchema = v.object({
  shell: v.optional(v.pipe(v.string(), v.minLength(1))),
  serverPort: v.optional(PortSchema),
  clientPort: v.optional(PortSchema),
  initialCommand: v.optional(v.string()),
  auxInitialCommand: v.optional(v.string()),
  defaultDirectory: v.optional(v.string()),
  playbooks: v.optional(v.array(PlaybookSchema)),
});

export type PlaybookCommand = v.InferOutput<typeof PlaybookCommandSchema>;
export type PlaybookConfig = v.InferOutput<typeof PlaybookSchema>;
type RawConfig = v.InferOutput<typeof ConfigSchema>;

export interface Config {
  shell: string;
  serverPort: number;
  clientPort: number;
  initialCommand?: string;
  auxInitialCommand?: string;
  defaultDirectory?: string;
  playbooks?: PlaybookConfig[];
}

function defaultShell(): string {
  if (platform() === 'win32') return 'powershell.exe';
  return process.env.SHELL || '/bin/sh';
}

function defaultConfig(): Config {
  return { shell: defaultShell(), serverPort: 3000, clientPort: 5173 };
}

function applyDefaults(raw: RawConfig): Config {
  const defaults = defaultConfig();
  return {
    shell: raw.shell ?? defaults.shell,
    serverPort: raw.serverPort ?? defaults.serverPort,
    clientPort: raw.clientPort ?? defaults.clientPort,
    initialCommand: raw.initialCommand,
    auxInitialCommand: raw.auxInitialCommand,
    defaultDirectory: raw.defaultDirectory,
    playbooks: raw.playbooks,
  };
}

function resolveConfigPath(configPath?: string): string {
  return configPath ?? resolve(import.meta.dirname, '../../config.json');
}

function formatIssues(issues: readonly v.BaseIssue<unknown>[]): string {
  return issues
    .map((issue) => {
      const path = issue.path?.map((p) => p.key).join('.') ?? '';
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join('; ');
}

export function loadConfig(configPath?: string): Config {
  const path = resolveConfigPath(configPath);
  if (!existsSync(path)) return defaultConfig();

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    console.warn(`[config] failed to parse ${path}: ${(err as Error).message}`);
    return defaultConfig();
  }

  const result = v.safeParse(ConfigSchema, raw);
  if (!result.success) {
    console.warn(`[config] ${path} failed validation: ${formatIssues(result.issues)}`);
    return defaultConfig();
  }
  return applyDefaults(result.output);
}

export interface RuntimeConfig {
  initialCommand?: string;
  auxInitialCommand?: string;
  defaultDirectory?: string;
  playbooks?: PlaybookConfig[];
}

export function toRuntimeConfig(config: Config): RuntimeConfig {
  return {
    initialCommand: config.initialCommand,
    auxInitialCommand: config.auxInitialCommand,
    defaultDirectory: config.defaultDirectory,
    playbooks: config.playbooks,
  };
}

export function updateRuntimeConfig(runtime: RuntimeConfig, config: Config): void {
  runtime.initialCommand = config.initialCommand;
  runtime.auxInitialCommand = config.auxInitialCommand;
  runtime.defaultDirectory = config.defaultDirectory;
  runtime.playbooks = config.playbooks;
}

export interface ConfigWatcher {
  dispose: () => void;
}

export function watchConfig(
  configPath: string | undefined,
  onChange: (config: Config) => void,
  options: { debounceMs?: number } = {},
): ConfigWatcher {
  const path = resolveConfigPath(configPath);
  const debounceMs = options.debounceMs ?? 150;
  let timer: NodeJS.Timeout | null = null;
  let lastSerialized = JSON.stringify(loadConfig(path));
  let watcher: FSWatcher | null = null;

  const reload = (): void => {
    const next = loadConfig(path);
    const serialized = JSON.stringify(next);
    if (serialized === lastSerialized) return;
    lastSerialized = serialized;
    onChange(next);
  };

  const schedule = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(reload, debounceMs);
  };

  try {
    watcher = watch(path, { persistent: false }, schedule);
    watcher.on('error', (err) => {
      console.warn(`[config] watcher error: ${err.message}`);
    });
  } catch (err) {
    // File may not exist yet; fall back to polling for creation.
    console.warn(`[config] watch failed for ${path}: ${(err as Error).message}`);
  }

  return {
    dispose: () => {
      if (timer) clearTimeout(timer);
      watcher?.close();
    },
  };
}
