import express from 'express';
import { createServer, IncomingMessage } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { resolve } from 'node:path';
import { loadConfig } from './config.js';
import { createRouter } from './routes.js';
import { getSession, killAllSessions, type Session } from './sessions.js';
import { resizePty } from './pty-manager.js';
import { startNotificationWatcher, stopNotificationWatcher, clearIfPermission } from './notification-watcher.js';

const config = loadConfig();
const app = express();

app.use(express.json());
app.use(createRouter(config.shell));

// Serve client build in production
const clientDist = resolve(import.meta.dirname, '../../client/dist');
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
        if (msg.type === 'resize' && typeof msg.cols === 'number' && typeof msg.rows === 'number') {
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

server.listen(config.serverPort, () => {
  console.log(`agent-mux listening on http://localhost:${config.serverPort}`);

  startNotificationWatcher({
    onStateChange: (sessionId, state) => {
      const ws = activeConnections.get(sessionId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'notification', sessionId, state }));
      }
    },
  });
});

// Cleanup
function cleanup() {
  stopNotificationWatcher();
  killAllSessions();
  server.close();
}

process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });
process.on('SIGHUP', () => { cleanup(); process.exit(0); });
process.on('uncaughtException', (err) => {
  console.error('agent-mux crashed:', err);
  cleanup();
  process.exit(1);
});
