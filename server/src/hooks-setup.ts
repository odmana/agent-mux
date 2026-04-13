import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';

const MARKER = '# agent-mux';

export interface HooksStatus {
  configured: boolean;
  settingsExists: boolean;
  missing: string[];
  error?: string;
}

export interface InstallResult {
  success: boolean;
  backupPath?: string;
  error?: string;
  added: string[];
}

interface HookEntry {
  matcher?: string;
  hooks: { type: string; command: string }[];
}

function getSettingsPath(): string {
  return join(homedir(), '.claude', 'settings.json');
}

function hookCommand(event: string): string {
  const tmpPath = platform() === 'win32' ? '$TEMP' : '/tmp';
  return `echo "${event} $(pwd)" > "${tmpPath}/agent-mux-$$.state" ${MARKER}`;
}

function hasMarkerInHooks(hooks: { type: string; command: string }[]): boolean {
  return hooks.some((h) => typeof h.command === 'string' && h.command.includes(MARKER));
}

function hasMarkerInEntries(entries: HookEntry[]): boolean {
  return entries.some((e) => Array.isArray(e.hooks) && hasMarkerInHooks(e.hooks));
}

function hasMarkerInNotification(entries: HookEntry[], matcher: string): boolean {
  return entries.some(
    (e) => e.matcher === matcher && Array.isArray(e.hooks) && hasMarkerInHooks(e.hooks),
  );
}

export function checkHooksStatus(): HooksStatus {
  const settingsPath = getSettingsPath();
  const missing: string[] = [];

  if (!existsSync(settingsPath)) {
    return {
      configured: false,
      settingsExists: false,
      missing: [
        'UserPromptSubmit',
        'Stop',
        'Notification:idle_prompt',
        'Notification:permission_prompt',
      ],
    };
  }

  let settings: Record<string, unknown>;
  try {
    settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
  } catch {
    return {
      configured: false,
      settingsExists: true,
      missing: [
        'UserPromptSubmit',
        'Stop',
        'Notification:idle_prompt',
        'Notification:permission_prompt',
      ],
      error: 'settings.json contains malformed JSON',
    };
  }

  const hooks = (settings.hooks ?? {}) as Record<string, HookEntry[]>;

  if (!Array.isArray(hooks.UserPromptSubmit) || !hasMarkerInEntries(hooks.UserPromptSubmit)) {
    missing.push('UserPromptSubmit');
  }
  if (!Array.isArray(hooks.Stop) || !hasMarkerInEntries(hooks.Stop)) {
    missing.push('Stop');
  }

  const notifications = Array.isArray(hooks.Notification) ? hooks.Notification : [];
  if (!hasMarkerInNotification(notifications, 'idle_prompt')) {
    missing.push('Notification:idle_prompt');
  }
  if (!hasMarkerInNotification(notifications, 'permission_prompt')) {
    missing.push('Notification:permission_prompt');
  }

  return {
    configured: missing.length === 0,
    settingsExists: true,
    missing,
  };
}

export function installHooks(): InstallResult {
  const status = checkHooksStatus();
  if (status.configured) {
    return { success: true, added: [] };
  }
  if (status.error) {
    return { success: false, error: status.error, added: [] };
  }

  const settingsPath = getSettingsPath();
  const settingsDir = join(homedir(), '.claude');
  let backupPath: string | undefined;

  // Parse existing or start fresh
  let settings: Record<string, unknown>;
  if (status.settingsExists) {
    settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    // Create backup
    backupPath = settingsPath + '.bak';
    copyFileSync(settingsPath, backupPath);
  } else {
    mkdirSync(settingsDir, { recursive: true });
    settings = {};
  }

  if (!settings.hooks) settings.hooks = {};
  const hooks = settings.hooks as Record<string, HookEntry[]>;
  const added: string[] = [];

  // UserPromptSubmit
  if (status.missing.includes('UserPromptSubmit')) {
    if (!Array.isArray(hooks.UserPromptSubmit)) hooks.UserPromptSubmit = [];
    hooks.UserPromptSubmit.push({
      hooks: [{ type: 'command', command: hookCommand('working') }],
    });
    added.push('UserPromptSubmit');
  }

  // Stop
  if (status.missing.includes('Stop')) {
    if (!Array.isArray(hooks.Stop)) hooks.Stop = [];
    hooks.Stop.push({
      hooks: [{ type: 'command', command: hookCommand('idle') }],
    });
    added.push('Stop');
  }

  // Notification hooks
  if (!Array.isArray(hooks.Notification)) hooks.Notification = [];

  for (const [matcher, event] of [
    ['idle_prompt', 'idle'],
    ['permission_prompt', 'permission'],
  ] as const) {
    const key = `Notification:${matcher}`;
    if (!status.missing.includes(key)) continue;

    const existing = hooks.Notification.find((e) => e.matcher === matcher);
    if (existing) {
      // Append agent-mux command to existing entry
      existing.hooks.push({ type: 'command', command: hookCommand(event) });
    } else {
      hooks.Notification.push({
        matcher,
        hooks: [{ type: 'command', command: hookCommand(event) }],
      });
    }
    added.push(key);
  }

  try {
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
  } catch (err) {
    return { success: false, error: `Failed to write settings: ${err}`, added: [] };
  }

  return { success: true, backupPath, added };
}
