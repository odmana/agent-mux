import { startServer } from './server.js';

const { cleanup } = await startServer();

function shutdown() {
  cleanup();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('SIGHUP', shutdown);
process.on('uncaughtException', (err) => {
  console.error('agent-mux crashed:', err);
  cleanup();
  process.exit(1);
});
