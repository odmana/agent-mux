import { join } from 'node:path';

import { startServer, type ServerInstance, type NotificationState } from 'agent-mux-server/server';
import { app, BrowserWindow, Menu, dialog, nativeImage } from 'electron';

let mainWindow: BrowserWindow | null = null;
let serverInstance: ServerInstance | null = null;

// Sessions currently in 'permission' state (tracked for taskbar badge)
const permissionSessions = new Set<string>();

// 16x16 bright red circle PNG as base64 data URL (for Windows overlay icon)
const BADGE_ICON_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAWE' +
  'lEQVR4nGNgGJTgv7Fx6X9j4zP/jY1/QjGIXUqMRmWo4v84MEhOGZ8B+DTDDcHnbEKaYR' +
  'jTO0TajtsV0MAi1oCfNDGAYi9QFogURyMDNRISmndIT8oDAgDBLR1gDiDr/QAAAABJRU5' +
  'ErkJggg==';

function updateBadge(count: number): void {
  if (process.platform === 'win32') {
    if (!mainWindow) return;
    if (count > 0) {
      const icon = nativeImage.createFromDataURL(BADGE_ICON_DATA_URL);
      mainWindow.setOverlayIcon(icon, `${count} tab(s) need permission`);
    } else {
      mainWindow.setOverlayIcon(null, '');
    }
  } else if (process.platform === 'darwin') {
    app.dock?.setBadge(count > 0 ? String(count) : '');
  } else {
    app.setBadgeCount(count);
  }
}

// Single instance lock — refocus existing window on second launch
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(start);
}

function resolveConfigPath(): string {
  if (app.isPackaged) {
    return join(app.getPath('userData'), 'config.json');
  }
  return join(import.meta.dirname, '../../config.json');
}

function resolveStatePath(): string {
  if (app.isPackaged) {
    return join(app.getPath('userData'), 'state.json');
  }
  return join(import.meta.dirname, '../../state.json');
}

function resolveClientDist(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'client-dist');
  }
  return join(import.meta.dirname, '../../client/dist');
}

let quitting = false;
async function quit() {
  if (quitting) return;
  quitting = true;
  await serverInstance?.cleanup();
  process.exit(0);
}

async function start() {
  const devHot = process.argv.includes('--dev-hot');
  serverInstance = await startServer({
    configPath: resolveConfigPath(),
    clientDistPath: resolveClientDist(),
    randomPort: !devHot,
    statePath: resolveStatePath(),
  });

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 500,
    title: 'Agent Mux',
    backgroundColor: '#2e3440',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.setAutoHideMenuBar(true);

  // In dev:hot mode, load from Vite dev server for HMR; otherwise load from the bundled server
  const clientUrl = devHot
    ? `http://localhost:${serverInstance.clientPort}`
    : `http://localhost:${serverInstance.port}`;

  if (devHot) {
    // Vite dev server may not be ready yet — retry until it is
    const maxRetries = 20;
    for (let i = 0; i < maxRetries; i++) {
      try {
        await fetch(clientUrl);
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }

  mainWindow.loadURL(clientUrl);

  mainWindow.webContents.on('context-menu', (_event, params) => {
    const menu = Menu.buildFromTemplate([
      { role: 'copy', enabled: params.selectionText.length > 0 },
      { role: 'paste' },
      { type: 'separator' },
      { role: 'selectAll' },
      { type: 'separator' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      {
        label: 'Toggle Menu Bar',
        click: () => {
          const visible = mainWindow!.isMenuBarVisible();
          mainWindow!.setMenuBarVisibility(!visible);
        },
      },
    ]);
    menu.popup();
  });

  mainWindow.webContents.on('will-prevent-unload', (event) => {
    const choice = dialog.showMessageBoxSync(mainWindow!, {
      type: 'question',
      buttons: ['Leave', 'Stay'],
      title: 'Quit Agent Mux?',
      message: 'Active terminal sessions will be closed.',
      defaultId: 0,
      cancelId: 1,
    });
    if (choice === 0) {
      event.preventDefault();
    }
  });

  serverInstance.onNotificationStateChange((sessionId: string, state: NotificationState) => {
    if (state === 'permission') {
      permissionSessions.add(sessionId);
    } else {
      permissionSessions.delete(sessionId);
    }
    updateBadge(permissionSessions.size);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    quit();
  });
}

app.on('window-all-closed', quit);

// In dev, `pnpm dev` propagates Ctrl+C as SIGINT. Without these handlers the
// process dies before cleanup runs, leaving playbook child processes orphaned.
process.on('SIGINT', quit);
process.on('SIGTERM', quit);
process.on('SIGHUP', quit);
