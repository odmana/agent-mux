import { startServer } from './server.js';

const { cleanup } = await startServer();

async function shutdown() {
  await cleanup();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('SIGHUP', shutdown);
process.on('uncaughtException', async (err) => {
  console.error('agent-mux crashed:', err);
  await cleanup();
  process.exit(1);
});
