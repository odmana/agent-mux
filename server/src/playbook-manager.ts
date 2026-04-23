import { Writable } from 'node:stream';

import { concurrently, Command } from 'concurrently';

import type { PlaybookConfig } from './config.js';

/** A no-op writable stream to suppress concurrently's built-in output. */
const devNull = new Writable({
  write(_chunk, _enc, cb) {
    cb();
  },
});

const LOG_BUFFER_LIMIT = 100 * 1024; // 100KB

// Cap per-command kill wait so a stuck child can't hang stopPlaybook forever.
const KILL_TIMEOUT_MS = 5000;

export interface LogEntry {
  source: string;
  text: string;
  timestamp: number;
}

export interface CommandStatus {
  label: string;
  status: 'running' | 'exited' | 'errored';
  exitCode?: number;
}

export interface PlaybookState {
  name: string;
  startedAt: number;
  commands: CommandStatus[];
  logs: LogEntry[];
}

interface RunningPlaybook {
  name: string;
  startedAt: number;
  commands: CommandStatus[];
  logs: LogEntry[];
  logSize: number;
  kill: () => Promise<void>;
  // Set once kill has started so concurrent stop/start calls share a single wait.
  killPromise?: Promise<void>;
}

const runningPlaybooks = new Map<string, RunningPlaybook>();

export async function startPlaybook(
  sessionId: string,
  playbook: PlaybookConfig,
  cwd: string,
  onOutput: (entry: { source: string; text: string }) => void,
  onStatusChange: (commands: CommandStatus[], startedAt: number) => void,
): Promise<void> {
  // Wait for any previous playbook's children to actually die before spawning
  // new ones — otherwise the old taskkill is still in flight while the new
  // processes try to bind the same ports and we end up with ghosts.
  await stopPlaybook(sessionId);

  const commandStatuses: CommandStatus[] = playbook.commands.map((cmd) => ({
    label: cmd.label,
    status: 'running',
  }));

  const state: RunningPlaybook = {
    name: playbook.name,
    startedAt: Date.now(),
    commands: commandStatuses,
    logs: [],
    logSize: 0,
    kill: async () => {},
  };
  runningPlaybooks.set(sessionId, state);

  const { result, commands } = concurrently(
    playbook.commands.map((cmd) => ({
      command: cmd.command,
      name: cmd.label,
      prefixColor: '',
      env: { FORCE_COLOR: '1' },
      cwd,
      raw: false,
    })),
    { killOthersOn: ['failure'], raw: true, outputStream: devNull },
  );

  state.kill = () => {
    const closePromises: Promise<void>[] = [];
    for (const cmd of commands) {
      // Already exited (no pid/process) — nothing to wait for.
      if (!Command.canKill(cmd)) continue;
      closePromises.push(
        new Promise<void>((resolve) => {
          const sub = cmd.close.subscribe(() => {
            sub.unsubscribe();
            resolve();
          });
          // Safety net: if the close event never arrives, don't hang forever.
          const timer = setTimeout(() => {
            sub.unsubscribe();
            resolve();
          }, KILL_TIMEOUT_MS);
          sub.add(() => clearTimeout(timer));
          cmd.kill('SIGTERM');
        }),
      );
    }
    return Promise.all(closePromises).then(() => {});
  };

  // Subscribe to per-command output
  for (let i = 0; i < commands.length; i++) {
    const label = playbook.commands[i].label;

    commands[i].stdout.subscribe((data) => {
      const text = typeof data === 'string' ? data : data.toString();
      addLog(state, label, text);
      onOutput({ source: label, text });
    });

    commands[i].stderr.subscribe((data) => {
      const text = typeof data === 'string' ? data : data.toString();
      addLog(state, label, text);
      onOutput({ source: label, text });
    });

    commands[i].close.subscribe((event) => {
      const exitCode = typeof event.exitCode === 'number' ? event.exitCode : Number(event.exitCode);
      commandStatuses[i].exitCode = exitCode;
      commandStatuses[i].status = exitCode === 0 ? 'exited' : 'errored';
      onStatusChange([...commandStatuses], state.startedAt);
    });
  }

  onStatusChange([...commandStatuses], state.startedAt);

  // Clean up when all commands finish. Guard the delete with an identity
  // check — by the time this fires, a newer playbook may own the map entry
  // (user hit stop → start quickly), and we must not clobber it.
  result
    .then(() => {
      // All exited successfully — keep state for log viewing.
    })
    .catch(() => {
      if (runningPlaybooks.get(sessionId) === state) {
        runningPlaybooks.delete(sessionId);
      }
    });
}

function addLog(state: RunningPlaybook, source: string, text: string): void {
  const entry: LogEntry = { source, text, timestamp: Date.now() };
  state.logs.push(entry);
  state.logSize += text.length;

  // Trim oldest entries when exceeding buffer limit
  while (state.logSize > LOG_BUFFER_LIMIT && state.logs.length > 1) {
    const removed = state.logs.shift()!;
    state.logSize -= removed.text.length;
  }
}

export function getPlaybookState(sessionId: string): PlaybookState | null {
  const running = runningPlaybooks.get(sessionId);
  if (!running) return null;
  return {
    name: running.name,
    startedAt: running.startedAt,
    commands: [...running.commands],
    logs: [...running.logs],
  };
}

export async function stopPlaybook(sessionId: string): Promise<void> {
  const running = runningPlaybooks.get(sessionId);
  if (!running) return;
  // Dedupe concurrent stop calls: reuse the in-flight kill instead of firing
  // tree-kill twice. The map entry stays until the kill resolves, so a
  // racing startPlaybook's `await stopPlaybook` blocks on the same promise.
  if (!running.killPromise) {
    running.killPromise = running.kill();
  }
  await running.killPromise;
  if (runningPlaybooks.get(sessionId) === running) {
    runningPlaybooks.delete(sessionId);
  }
}

export async function stopAllPlaybooks(): Promise<void> {
  const ids = [...runningPlaybooks.keys()];
  await Promise.all(ids.map((id) => stopPlaybook(id)));
}
