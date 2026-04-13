import { join } from 'node:path';

import { startServer, type ServerInstance } from 'agent-mux-server/server';
import { app, BrowserWindow, Menu, dialog } from 'electron';

let mainWindow: BrowserWindow | null = null;
let serverInstance: ServerInstance | null = null;

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

function resolveClientDist(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'client-dist');
  }
  return join(import.meta.dirname, '../../client/dist');
}

function quit() {
  serverInstance?.cleanup();
  process.exit(0);
}

async function start() {
  serverInstance = await startServer({
    configPath: resolveConfigPath(),
    clientDistPath: resolveClientDist(),
    randomPort: true,
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

  mainWindow.loadURL(`http://localhost:${serverInstance.port}`);

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

  mainWindow.on('closed', () => {
    mainWindow = null;
    quit();
  });
}

app.on('window-all-closed', quit);
