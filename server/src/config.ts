import { readFileSync, existsSync } from 'node:fs';
import { platform } from 'node:os';
import { resolve } from 'node:path';

export interface PlaybookCommand {
  label: string;
  command: string;
}

export interface PlaybookConfig {
  name: string;
  commands: PlaybookCommand[];
}

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

function parsePlaybooks(raw: unknown): PlaybookConfig[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const valid: PlaybookConfig[] = [];
  for (const entry of raw) {
    if (
      typeof entry === 'object' &&
      entry !== null &&
      typeof entry.name === 'string' &&
      Array.isArray(entry.commands) &&
      entry.commands.length > 0
    ) {
      const commands: PlaybookCommand[] = [];
      for (const cmd of entry.commands) {
        if (
          typeof cmd === 'object' &&
          cmd !== null &&
          typeof cmd.label === 'string' &&
          typeof cmd.command === 'string'
        ) {
          commands.push({ label: cmd.label, command: cmd.command });
        }
      }
      if (commands.length > 0) {
        valid.push({ name: entry.name, commands });
      }
    }
  }
  return valid.length > 0 ? valid : undefined;
}

export function loadConfig(configPath?: string): Config {
  const defaults: Config = {
    shell: defaultShell(),
    serverPort: 3000,
    clientPort: 5173,
  };

  configPath ??= resolve(import.meta.dirname, '../../config.json');
  if (!existsSync(configPath)) return defaults;

  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
    return {
      shell: typeof raw.shell === 'string' ? raw.shell : defaults.shell,
      serverPort: typeof raw.serverPort === 'number' ? raw.serverPort : defaults.serverPort,
      clientPort: typeof raw.clientPort === 'number' ? raw.clientPort : defaults.clientPort,
      initialCommand: typeof raw.initialCommand === 'string' ? raw.initialCommand : undefined,
      auxInitialCommand:
        typeof raw.auxInitialCommand === 'string' ? raw.auxInitialCommand : undefined,
      defaultDirectory: typeof raw.defaultDirectory === 'string' ? raw.defaultDirectory : undefined,
      playbooks: parsePlaybooks(raw.playbooks),
    };
  } catch {
    return defaults;
  }
}
