import { Writable } from 'node:stream';

import { concurrently } from 'concurrently';

import type { PlaybookConfig } from './config.js';

/** A no-op writable stream to suppress concurrently's built-in output. */
const devNull = new Writable({
  write(_chunk, _enc, cb) {
    cb();
  },
});

const LOG_BUFFER_LIMIT = 100 * 1024; // 100KB

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
  commands: CommandStatus[];
  logs: LogEntry[];
}

interface RunningPlaybook {
  name: string;
  commands: CommandStatus[];
  logs: LogEntry[];
  logSize: number;
  kill: () => void;
}

const runningPlaybooks = new Map<string, RunningPlaybook>();

export async function startPlaybook(
  sessionId: string,
  playbook: PlaybookConfig,
  cwd: string,
  onOutput: (entry: { source: string; text: string }) => void,
  onStatusChange: (commands: CommandStatus[]) => void,
): Promise<void> {
  // Stop any existing playbook for this session
  await stopPlaybook(sessionId);

  const commandStatuses: CommandStatus[] = playbook.commands.map((cmd) => ({
    label: cmd.label,
    status: 'running',
  }));

  const state: RunningPlaybook = {
    name: playbook.name,
    commands: commandStatuses,
    logs: [],
    logSize: 0,
    kill: () => {},
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
    for (const cmd of commands) {
      cmd.kill('SIGTERM');
    }
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
      onStatusChange([...commandStatuses]);
    });
  }

  onStatusChange([...commandStatuses]);

  // Clean up when all commands finish
  result
    .then(() => {
      // All exited successfully -- keep state for log viewing
    })
    .catch(() => {
      // At least one errored -- killOthersOn handled the rest
    })
    .finally(() => {
      runningPlaybooks.delete(sessionId);
      onStatusChange([...commandStatuses]);
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
    commands: [...running.commands],
    logs: [...running.logs],
  };
}

export async function stopPlaybook(sessionId: string): Promise<void> {
  const running = runningPlaybooks.get(sessionId);
  if (!running) return;
  running.kill();
  runningPlaybooks.delete(sessionId);
  // Give processes a moment to exit
  await new Promise((resolve) => setTimeout(resolve, 100));
}

export async function stopAllPlaybooks(): Promise<void> {
  const ids = [...runningPlaybooks.keys()];
  await Promise.all(ids.map((id) => stopPlaybook(id)));
}
