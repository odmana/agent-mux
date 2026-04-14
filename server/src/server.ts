import { createServer, type IncomingMessage, type Server } from 'node:http';
import { resolve } from 'node:path';

import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';

import { loadConfig } from './config.js';
import {
  startNotificationWatcher,
  stopNotificationWatcher,
  clearIfPermission,
  type NotificationState,
} from './notification-watcher.js';
import { resizePty } from './pty-manager.js';
import { createRouter } from './routes.js';
import { getSession, killAllSessions, onBranchChange, type Session } from './sessions.js';

export interface StartServerOptions {
  configPath?: string;
  clientDistPath?: string;
  randomPort?: boolean;
}

export type { NotificationState } from './notification-watcher.js';

export interface ServerInstance {
  server: Server;
  port: number;
  cleanup: () => void;
  onNotificationStateChange: (
    handler: (sessionId: string, state: NotificationState) => void,
  ) => void;
}

export function startServer(options: StartServerOptions = {}): Promise<ServerInstance> {
  const config = loadConfig(options.configPath);
  const app = express();

  app.use(express.json());
  app.use(createRouter(config.shell));

  // Serve client build in production
  const clientDist = options.clientDistPath ?? resolve(import.meta.dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('{*path}', (_req, res, next) => {
    // Only serve index.html for non-API routes
    if (_req.path.startsWith('/api')) return next();
    res.sendFile(resolve(clientDist, 'index.html'), (err) => {
      if (err) next();
    });
  });

  const server = createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  // Track active WebSocket per session to prevent duplicates
  const activeConnections = new Map<string, WebSocket>();

  // Handle WebSocket upgrade on /ws/:sessionId
  server.on('upgrade', (req, socket, head) => {
    // Reject cross-origin WebSocket connections (CSRF protection)
    const origin = req.headers.origin;
    if (origin) {
      const actualPort = (server.address() as { port: number })?.port ?? config.serverPort;
      const allowed = [
        `http://localhost:${actualPort}`,
        `http://127.0.0.1:${actualPort}`,
        `http://localhost:${config.clientPort}`,
        `http://127.0.0.1:${config.clientPort}`,
      ];
      if (!allowed.includes(origin)) {
        socket.destroy();
        return;
      }
    }

    const match = req.url?.match(/^\/ws\/(.+)$/);
    if (!match) {
      socket.destroy();
      return;
    }

    const session = getSession(match[1]);
    if (!session) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, session);
    });
  });

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage, session: Session) => {
    // Close any existing connection for this session
    const existing = activeConnections.get(session.id);
    if (existing && existing.readyState === WebSocket.OPEN) {
      existing.close();
    }
    activeConnections.set(session.id, ws);

    // Replay scrollback buffer on reconnect
    if (session.scrollback.length > 0) {
      ws.send(session.scrollback);
    }

    // PTY → client
    const dataHandler = session.pty.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
      // Clear permission notification when PTY produces output (permission was granted)
      clearIfPermission(session.id);
    });

    // Client → PTY
    ws.on('message', (raw: Buffer | string) => {
      const str = raw.toString();

      // Check for JSON control messages
      if (str.startsWith('{')) {
        try {
          const msg = JSON.parse(str);
          if (
            msg.type === 'resize' &&
            typeof msg.cols === 'number' &&
            typeof msg.rows === 'number'
          ) {
            resizePty(session.pty, msg.cols, msg.rows);
            return;
          }
        } catch {
          // Not valid JSON — treat as terminal input
        }
      }

      try {
        session.pty.write(str);
      } catch {
        // PTY may have already exited
      }
    });

    // Handle PTY exit (user types exit, process crashes, etc.)
    const exitHandler = session.pty.onExit(() => {
      ws.close();
    });

    ws.on('close', () => {
      dataHandler.dispose();
      exitHandler.dispose();
      if (activeConnections.get(session.id) === ws) {
        activeConnections.delete(session.id);
      }
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
    });
  });

  return new Promise((resolvePromise) => {
    let externalNotificationHandler:
      | ((sessionId: string, state: NotificationState) => void)
      | null = null;

    const listenPort = options.randomPort ? 0 : config.serverPort;
    server.listen(listenPort, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : config.serverPort;

      console.log(`agent-mux listening on http://localhost:${port}`);

      onBranchChange((sessionId, branch) => {
        const ws = activeConnections.get(sessionId);
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'branch_update', sessionId, branch }));
        }
      });

      startNotificationWatcher({
        onStateChange: (sessionId, state) => {
          const ws = activeConnections.get(sessionId);
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'notification', sessionId, state }));
          }
          externalNotificationHandler?.(sessionId, state);
        },
      });

      resolvePromise({
        server,
        port,
        cleanup: () => {
          stopNotificationWatcher();
          killAllSessions();
          server.close();
        },
        onNotificationStateChange: (handler) => {
          externalNotificationHandler = handler;
        },
      });
    });
  });
}
