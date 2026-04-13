import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { platform } from "node:os";

export interface Config {
  shell: string;
  serverPort: number;
  clientPort: number;
}

function defaultShell(): string {
  if (platform() === "win32") return "powershell.exe";
  return process.env.SHELL || "/bin/sh";
}

export function loadConfig(): Config {
  const defaults: Config = {
    shell: defaultShell(),
    serverPort: 3000,
    clientPort: 5173,
  };

  const configPath = resolve(import.meta.dirname, "../../config.json");
  if (!existsSync(configPath)) return defaults;

  try {
    const raw = JSON.parse(readFileSync(configPath, "utf-8"));
    return {
      shell: typeof raw.shell === "string" ? raw.shell : defaults.shell,
      serverPort: typeof raw.serverPort === "number" ? raw.serverPort : defaults.serverPort,
      clientPort: typeof raw.clientPort === "number" ? raw.clientPort : defaults.clientPort,
    };
  } catch {
    return defaults;
  }
}
