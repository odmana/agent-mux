import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadConfig(): { serverPort: number; clientPort: number } {
  const defaults = { serverPort: 3000, clientPort: 5173 };
  try {
    const raw = JSON.parse(
      readFileSync(resolve(__dirname, "../config.json"), "utf-8"),
    );
    return {
      serverPort: typeof raw.serverPort === "number" ? raw.serverPort : defaults.serverPort,
      clientPort:
        typeof raw.clientPort === "number"
          ? raw.clientPort
          : defaults.clientPort,
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
      "/api": `http://localhost:${serverPort}`,
      "/ws": {
        target: `http://localhost:${serverPort}`,
        ws: true,
      },
    },
  },
});
