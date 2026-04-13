import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

function loadConfig(): { serverPort: number; clientPort: number } {
  const defaults = { serverPort: 3000, clientPort: 5173 };
  try {
    const raw = JSON.parse(readFileSync(resolve(__dirname, '../config.json'), 'utf-8'));
    return {
      serverPort: typeof raw.serverPort === 'number' ? raw.serverPort : defaults.serverPort,
      clientPort: typeof raw.clientPort === 'number' ? raw.clientPort : defaults.clientPort,
    };
  } catch {
    return defaults;
  }
}

const { serverPort, clientPort } = loadConfig();

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: clientPort,
    proxy: {
      '/api': `http://localhost:${serverPort}`,
      '/ws': {
        target: `http://localhost:${serverPort}`,
        ws: true,
        configure: (proxy) => {
          const origEmit = proxy.emit;
          proxy.emit = function (event: string, err: unknown, ...args: unknown[]) {
            if (event === 'error' && (err as NodeJS.ErrnoException)?.code === 'ECONNABORTED')
              return this;
            return origEmit.call(this, event, err, ...args);
          };
          proxy.on('proxyReqWs', (_proxyReq, _req, socket) => {
            process.nextTick(() => {
              const listeners = socket.listeners('error');
              socket.removeAllListeners('error');
              socket.on('error', (err: NodeJS.ErrnoException) => {
                if (
                  err.code === 'ECONNABORTED' ||
                  err.code === 'ECONNRESET' ||
                  err.code === 'EPIPE'
                )
                  return;
                for (const fn of listeners) (fn as (err: Error) => void)(err);
              });
            });
          });
        },
      },
    },
  },
});
