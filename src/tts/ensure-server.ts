import { spawn, type ChildProcess, type SpawnOptions } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { DEFAULT_POCKET_TTS, loadConfig, saveConfig, type PocketTtsSettings } from "../config.js";
import type { SpeechLanguage } from "./language.js";
import {
  buildBaseUrl,
  DEFAULT_POCKET_TTS_PORT,
  findAvailablePort,
  isPortAvailable,
  LEGACY_POCKET_TTS_PORT,
  parseListenAddress,
} from "../ports.js";
import { isPocketTtsHealthy, normalizeBaseUrl } from "./pocket-tts.js";

const STARTUP_TIMEOUT_MS = 180_000;
const POLL_INTERVAL_MS = 1_000;
const OCCUPIED_HEALTH_TIMEOUT_MS = 400;
const BIND_RETRY_LIMIT = 5;

/** talk-to-cursor repo root, not the Cursor workspace that launched the MCP. */
export const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const sidecars = new Map<string, ChildProcess>();

export interface PocketTtsListenTarget {
  host: string;
  port: number;
  baseUrl: string;
  alreadyRunning: boolean;
}

export interface EnsurePocketTtsOptions {
  kind?: SpeechLanguage;
  skipPorts?: number[];
}

export function pocketTtsServeAttempts(
  host: string,
  port: number,
  language: string
): Array<{ command: string; args: string[] }> {
  const args = [
    "serve",
    "--host",
    host,
    "--port",
    String(port),
    "--language",
    language || DEFAULT_POCKET_TTS.language,
  ];
  return [
    // Prefer a user-level install so other Cursor projects do not run uvx
    // (and download packages) in that project's folder.
    { command: "pocket-tts", args },
    { command: "uv", args: ["tool", "run", "--from", "pocket-tts", "pocket-tts", ...args] },
    { command: "uvx", args: ["--from", "pocket-tts", "pocket-tts", ...args] },
  ];
}

export function pocketTtsSpawnOptions(
  stdio: SpawnOptions["stdio"],
  extra: Pick<SpawnOptions, "detached" | "windowsHide"> = {}
): SpawnOptions {
  return {
    cwd: PACKAGE_ROOT,
    env: {
      ...process.env,
      UV_NO_PROJECT: "1",
    },
    stdio,
    shell: process.platform === "win32",
    windowsHide: extra.windowsHide ?? true,
    detached: extra.detached,
  };
}

export async function resolvePocketTtsListenTarget(
  settings: PocketTtsSettings,
  options: { skipPorts?: number[] } = {}
): Promise<PocketTtsListenTarget> {
  const skip = new Set(options.skipPorts || []);
  const configured = parseListenAddress(settings.baseUrl, DEFAULT_POCKET_TTS_PORT);
  const preferredPort = skip.has(configured.port)
    ? configured.port + 1
    : configured.port;

  const configuredUrl = normalizeBaseUrl(settings.baseUrl);
  if (!skip.has(configured.port) && await isPocketTtsHealthy(configuredUrl, OCCUPIED_HEALTH_TIMEOUT_MS)) {
    return {
      host: configured.host,
      port: configured.port,
      baseUrl: configuredUrl,
      alreadyRunning: true,
    };
  }

  for (let i = 0; i < 30; i++) {
    const port = preferredPort + i;
    if (port > 65535) {
      break;
    }
    if (skip.has(port)) {
      continue;
    }
    const baseUrl = buildBaseUrl(configured.host, port);
    if (await isPortAvailable(port, configured.host)) {
      return {
        host: configured.host,
        port,
        baseUrl,
        alreadyRunning: false,
      };
    }
    if (await isPocketTtsHealthy(baseUrl, OCCUPIED_HEALTH_TIMEOUT_MS)) {
      return {
        host: configured.host,
        port,
        baseUrl,
        alreadyRunning: true,
      };
    }
    console.error(`[TTS] Port ${port} is in use; trying the next one`);
  }

  const port = await findAvailablePort(preferredPort, configured.host, undefined, skip);
  return {
    host: configured.host,
    port,
    baseUrl: buildBaseUrl(configured.host, port),
    alreadyRunning: false,
  };
}

export function persistPocketTtsProfileUrl(kind: SpeechLanguage, baseUrl: string): void {
  if (kind === "english" && process.env.POCKET_TTS_URL) {
    return;
  }
  if (kind === "spanish" && process.env.POCKET_TTS_SPANISH_URL) {
    return;
  }
  const current = loadConfig();
  const profile = { ...current.pocketTts[kind], baseUrl };
  const pocketTts = {
    ...current.pocketTts,
    [kind]: profile,
  };
  if (kind === "english") {
    pocketTts.baseUrl = baseUrl;
  }
  if (pocketTts[kind].baseUrl === current.pocketTts[kind].baseUrl && current.pocketTts.baseUrl === pocketTts.baseUrl) {
    return;
  }
  saveConfig({ pocketTts });
}

/** @deprecated Use persistPocketTtsProfileUrl. Kept for the foreground starter. */
export function persistPocketTtsBaseUrl(baseUrl: string): void {
  persistPocketTtsProfileUrl("english", baseUrl);
}

function applyResolvedUrl(
  settings: PocketTtsSettings,
  baseUrl: string,
  kind?: SpeechLanguage
): void {
  settings.baseUrl = baseUrl;
  if (kind) {
    settings[kind] = { ...settings[kind], baseUrl };
    persistPocketTtsProfileUrl(kind, baseUrl);
    return;
  }
  persistPocketTtsBaseUrl(baseUrl);
}

function spawnServe(command: string, args: string[]): ChildProcess {
  const child = spawn(
    command,
    args,
    pocketTtsSpawnOptions("ignore", { detached: true, windowsHide: true })
  );
  child.unref();
  return child;
}

async function trySpawn(settings: PocketTtsSettings): Promise<ChildProcess> {
  const { host, port } = parseListenAddress(settings.baseUrl, DEFAULT_POCKET_TTS_PORT);
  const attempts = pocketTtsServeAttempts(host, port, settings.language || DEFAULT_POCKET_TTS.language);

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

export async function ensurePocketTtsServer(
  settings: PocketTtsSettings,
  options: EnsurePocketTtsOptions = {}
): Promise<string> {
  const kind = options.kind;
  const sidecarKey = kind || settings.language || "default";
  const skipPorts = [...(options.skipPorts || []), LEGACY_POCKET_TTS_PORT];
  let target = await resolvePocketTtsListenTarget(settings, { skipPorts });
  applyResolvedUrl(settings, target.baseUrl, kind);
  console.error(
    `[TTS] ${target.alreadyRunning ? "Reusing" : "Starting"} Pocket TTS ` +
      `${sidecarKey} at ${target.baseUrl} (model=${settings.language})`
  );

  if (target.alreadyRunning) {
    return target.baseUrl;
  }

  let sidecar = sidecars.get(sidecarKey);
  if (!sidecar || sidecar.killed || sidecar.exitCode !== null) {
    let lastError: unknown;
    for (let attempt = 0; attempt < BIND_RETRY_LIMIT; attempt++) {
      if (attempt > 0) {
        const port = await findAvailablePort(target.port + 1, target.host, undefined, skipPorts);
        target = {
          host: target.host,
          port,
          baseUrl: buildBaseUrl(target.host, port),
          alreadyRunning: false,
        };
        applyResolvedUrl(settings, target.baseUrl, kind);
        console.error(`[TTS] Retrying Pocket TTS ${sidecarKey} on ${target.baseUrl}`);
      }
      try {
        sidecar = await trySpawn({ ...settings, baseUrl: target.baseUrl });
        sidecars.set(sidecarKey, sidecar);
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!sidecar || sidecar.killed || sidecar.exitCode !== null) {
      const detail = lastError instanceof Error ? lastError.message : String(lastError);
      throw new Error(detail);
    }
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < STARTUP_TIMEOUT_MS) {
    if (await isPocketTtsHealthy(settings.baseUrl, 1500)) {
      console.error(`[TTS] Pocket TTS server is ready at ${settings.baseUrl} (${sidecarKey})`);
      return settings.baseUrl;
    }
    if (sidecar.killed || sidecar.exitCode !== null) {
      throw new Error(
        `Pocket TTS exited before becoming ready at ${settings.baseUrl} (code ${sidecar.exitCode}).`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(
    `Pocket TTS did not become ready at ${settings.baseUrl} within ${STARTUP_TIMEOUT_MS / 1000}s. ` +
      `The first run downloads model weights. Start it manually with: npm run pocket-tts`
  );
}
