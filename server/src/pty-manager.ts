import { spawn, type IPty } from 'node-pty';

export function createPty(
  shell: string,
  cwd: string,
  cols: number,
  rows: number,
): IPty {
  return spawn(shell, [], {
    cwd,
    cols,
    rows,
    name: 'xterm-256color',
    env: { ...process.env, TERM: 'xterm-256color' },
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
