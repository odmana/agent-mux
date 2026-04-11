import { readFileSync, existsSync } from 'node:fs';
import { platform } from 'node:os';

export interface Config {
  shell: string;
  port: number;
}

function defaultShell(): string {
  if (platform() === 'win32') return 'powershell.exe';
  return process.env.SHELL || '/bin/sh';
}

export function loadConfig(): Config {
  const defaults: Config = {
    shell: defaultShell(),
    port: 3000,
  };

  if (!existsSync('config.json')) return defaults;

  try {
    const raw = JSON.parse(readFileSync('config.json', 'utf-8'));
    return {
      shell: typeof raw.shell === 'string' ? raw.shell : defaults.shell,
      port: typeof raw.port === 'number' ? raw.port : defaults.port,
    };
  } catch {
    return defaults;
  }
}
