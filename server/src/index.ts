import express from 'express';
import { createServer, IncomingMessage } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { resolve } from 'node:path';
import { loadConfig } from './config.js';
import { createRouter } from './routes.js';
import { getSession, deleteSession, killAllSessions, type Session } from './sessions.js';
import { resizePty } from './pty-manager.js';

const config = loadConfig();
const app = express();

app.use(express.json());
app.use(createRouter(config.shell));

// Serve client build in production
const clientDist = resolve(import.meta.dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res, next) => {
  // Only serve index.html for non-API routes
  if (_req.path.startsWith('/api')) return next();
  res.sendFile(resolve(clientDist, 'index.html'), (err) => {
    if (err) next();
  });
});

const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

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
  // PTY → client
  const dataHandler = session.pty.onData((data: string) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
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

    session.pty.write(str);
  });

  // Handle PTY exit (user types exit, process crashes, etc.)
  const exitHandler = session.pty.onExit(() => {
    ws.close();
  });

  ws.on('close', () => {
    dataHandler.dispose();
    exitHandler.dispose();
    deleteSession(session.id);
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
});

server.listen(config.port, () => {
  console.log(`agent-mux listening on http://localhost:${config.port}`);
});

// Cleanup
function cleanup() {
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
