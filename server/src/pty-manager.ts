import { platform } from 'node:os';

import { spawn, type IPty } from 'node-pty';

export function createPty(shell: string, cwd: string, cols: number, rows: number): IPty {
  const args = platform() === 'win32' ? [] : ['-l'];
  return spawn(shell, args, {
    cwd,
    cols,
    rows,
    name: 'xterm-256color',
    env: { ...process.env, TERM: 'xterm-256color' },
    useConptyDll: true,
  });
}

export function resizePty(pty: IPty, cols: number, rows: number): void {
  pty.resize(cols, rows);
}

export function killPty(pty: IPty): void {
  try {
    pty.kill();
  } catch {
    // PTY process may have already exited
  }
}
