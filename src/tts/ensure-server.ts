import { spawn, type ChildProcess } from "child_process";
import type { PocketTtsSettings } from "../config.js";
import { isPocketTtsHealthy, normalizeBaseUrl } from "./pocket-tts.js";

const STARTUP_TIMEOUT_MS = 180_000;
const POLL_INTERVAL_MS = 1_000;

let sidecar: ChildProcess | null = null;

function parseListenAddress(baseUrl: string): { host: string; port: string } {
  try {
    const url = new URL(normalizeBaseUrl(baseUrl));
    return {
      host: url.hostname || "127.0.0.1",
      port: url.port || "8000",
    };
  } catch {
    return { host: "127.0.0.1", port: "8000" };
  }
}

function spawnServe(command: string, args: string[]): ChildProcess {
  const child = spawn(command, args, {
    stdio: "ignore",
    detached: true,
    shell: process.platform === "win32",
    windowsHide: true,
  });
  child.unref();
  return child;
}

async function trySpawn(settings: PocketTtsSettings): Promise<ChildProcess> {
  const { host, port } = parseListenAddress(settings.baseUrl);
  const args = [
    "serve",
    "--host",
    host,
    "--port",
    port,
    "--language",
    settings.language || "english",
  ];

  const attempts: Array<{ command: string; args: string[] }> = [
    { command: "uvx", args: ["pocket-tts", ...args] },
    { command: "pocket-tts", args },
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      const child = spawnServe(attempt.command, attempt.args);
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => {
          cleanup();
          reject(error);
        };
        const onExit = (code: number | null) => {
          cleanup();
          reject(new Error(`${attempt.command} exited immediately with code ${code}`));
        };
        const onSpawn = () => {
          // Keep listening for a fast crash (missing binary).
        };
        const timer = setTimeout(() => {
          cleanup();
          if (child.killed || child.exitCode !== null) {
            reject(new Error(`${attempt.command} exited immediately with code ${child.exitCode}`));
          } else {
            resolve();
          }
        }, 400);
        const cleanup = () => {
          clearTimeout(timer);
          child.removeListener("error", onError);
          child.removeListener("exit", onExit);
          child.removeListener("spawn", onSpawn);
        };
        child.once("error", onError);
        child.once("exit", onExit);
        child.once("spawn", onSpawn);
      });
      console.error(`[TTS] Started Pocket TTS with: ${attempt.command} ${attempt.args.join(" ")}`);
      return child;
    } catch (error) {
      lastError = error;
    }
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    `Could not start Pocket TTS. Install uv (https://docs.astral.sh/uv/) and run ` +
      `"uvx pocket-tts serve", or pip install pocket-tts. ${detail}`
  );
}

export async function ensurePocketTtsServer(settings: PocketTtsSettings): Promise<void> {
  if (await isPocketTtsHealthy(settings.baseUrl)) {
    return;
  }

  if (!sidecar || sidecar.killed || sidecar.exitCode !== null) {
    sidecar = await trySpawn(settings);
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < STARTUP_TIMEOUT_MS) {
    if (await isPocketTtsHealthy(settings.baseUrl, 1500)) {
      console.error("[TTS] Pocket TTS server is ready");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(
    `Pocket TTS did not become ready at ${settings.baseUrl} within ${STARTUP_TIMEOUT_MS / 1000}s. ` +
      `The first run downloads model weights. Start it manually with: npm run pocket-tts`
  );
}
