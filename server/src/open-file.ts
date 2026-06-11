import { spawn } from 'node:child_process';
import { platform } from 'node:os';

// Uses the OS default app for the file rather than $EDITOR, since $EDITOR is
// usually a terminal editor that needs a TTY the GUI app lacks.
export function openInEditor(path: string): void {
  const plat = platform();
  const [command, args] =
    plat === 'win32'
      ? ['cmd', ['/c', 'start', '', path]]
      : plat === 'darwin'
        ? ['open', [path]]
        : ['xdg-open', [path]];

  const child = spawn(command as string, args as string[], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}
