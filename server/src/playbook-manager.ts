import { Writable } from 'node:stream';

import { concurrently, Command } from 'concurrently';

import type { PlaybookConfig } from './config.js';

/** A no-op writable stream to suppress concurrently's built-in output. */
const devNull = new Writable({
  write(_chunk, _enc, cb) {
    cb();
  },
});

// Per-command buffer cap. Each command keeps its own recent output up to this
// many bytes, so a chatty command can't evict a quiet one's history. Total
// memory is roughly (number of commands) * this limit.
const LOG_BUFFER_LIMIT_PER_COMMAND = 100 * 1024; // 100KB

// Cap per-command kill wait so a stuck child can't hang stopPlaybook forever.
const KILL_TIMEOUT_MS = 5000;

export interface LogEntry {
  source: string;
  text: string;
  timestamp: number;
}

export interface CommandStatus {
  label: string;
  // 'pending' = waiting on a dependsOn command to exit successfully before it starts.
  status: 'pending' | 'running' | 'exited' | 'errored';
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
  // Bytes of buffered output per command source, used to trim each command's
  // history independently. Keyed by command label.
  sizes: Map<string, number>;
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

  // Every command starts gated: a command with no dependencies clears its gate
  // immediately (see the initial spawnReady() below); one with dependsOn waits
  // until each named command has exited successfully.
  const commandStatuses: CommandStatus[] = playbook.commands.map((cmd) => ({
    label: cmd.label,
    status: 'pending',
  }));

  const state: RunningPlaybook = {
    name: playbook.name,
    startedAt: Date.now(),
    commands: commandStatuses,
    logs: [],
    sizes: new Map(),
    kill: async () => {},
  };
  runningPlaybooks.set(sessionId, state);

  // Spawned children, accumulated as gates open. We spawn each command through
  // its own concurrently() call when its dependencies are satisfied, so we
  // implement "kill everything on failure" ourselves rather than relying on a
  // single call's killOthersOn.
  const spawned: Command[] = [];
  // Once set, no further commands spawn — used by both stop and failure paths.
  let cancelled = false;
  // label -> exited successfully (exit code 0). Drives dependent gates.
  const succeeded = new Map<string, boolean>();

  const emit = (): void => onStatusChange([...commandStatuses], state.startedAt);

  const killSpawned = (): Promise<void> => {
    const closePromises: Promise<void>[] = [];
    for (const cmd of spawned) {
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

  state.kill = () => {
    cancelled = true;
    return killSpawned();
  };

  // A command failed — tear the whole playbook down (mirrors the old
  // killOthersOn: ['failure']) and drop the map entry so a fresh start can
  // take over. Guard the delete with an identity check: by the time the kill
  // resolves, a newer playbook may already own this session's slot.
  const failPlaybook = (): void => {
    if (cancelled) return;
    cancelled = true;
    void killSpawned().then(() => {
      if (runningPlaybooks.get(sessionId) === state) {
        runningPlaybooks.delete(sessionId);
      }
    });
  };

  const spawnCommand = (index: number): void => {
    const cmd = playbook.commands[index];
    const label = cmd.label;
    commandStatuses[index].status = 'running';

    const { result, commands } = concurrently(
      [
        {
          command: cmd.command,
          name: label,
          prefixColor: '',
          env: { FORCE_COLOR: '1' },
          cwd,
          raw: false,
        },
      ],
      { raw: true, outputStream: devNull },
    );
    // Swallow the per-command rejection (non-zero exit) — failure is handled via
    // the close subscription below; an unhandled rejection would crash the process.
    result.catch(() => {});

    const child = commands[0];
    spawned.push(child);

    child.stdout.subscribe((data) => {
      const text = typeof data === 'string' ? data : data.toString();
      addLog(state, label, text);
      onOutput({ source: label, text });
    });

    child.stderr.subscribe((data) => {
      const text = typeof data === 'string' ? data : data.toString();
      addLog(state, label, text);
      onOutput({ source: label, text });
    });

    child.close.subscribe((event) => {
      const exitCode = typeof event.exitCode === 'number' ? event.exitCode : Number(event.exitCode);
      commandStatuses[index].exitCode = exitCode;
      const ok = exitCode === 0;
      commandStatuses[index].status = ok ? 'exited' : 'errored';
      succeeded.set(label, ok);
      emit();
      if (!ok) {
        failPlaybook();
        return;
      }
      spawnReady();
    });

    emit();
  };

  // Spawn every still-pending command whose dependencies have all exited 0.
  const spawnReady = (): void => {
    if (cancelled) return;
    for (let i = 0; i < playbook.commands.length; i++) {
      if (commandStatuses[i].status !== 'pending') continue;
      const deps = playbook.commands[i].dependsOn ?? [];
      if (deps.every((dep) => succeeded.get(dep) === true)) {
        spawnCommand(i);
      }
    }
  };

  spawnReady();
  emit();
}

function addLog(state: RunningPlaybook, source: string, text: string): void {
  const entry: LogEntry = { source, text, timestamp: Date.now() };
  state.logs.push(entry);
  state.sizes.set(source, (state.sizes.get(source) ?? 0) + text.length);

  // Trim only this command's oldest entries until it's back under its own
  // budget, leaving other commands' history untouched. Keep at least one entry
  // per source so a single oversized chunk can't erase the command entirely.
  while ((state.sizes.get(source) ?? 0) > LOG_BUFFER_LIMIT_PER_COMMAND) {
    const oldest = state.logs.findIndex((e) => e.source === source);
    const hasNewer =
      oldest !== -1 && state.logs.findIndex((e, i) => i > oldest && e.source === source) !== -1;
    if (!hasNewer) break;
    const [removed] = state.logs.splice(oldest, 1);
    state.sizes.set(source, (state.sizes.get(source) ?? 0) - removed.text.length);
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
