#!/usr/bin/env node

import { spawn, type ChildProcess } from "child_process";
import { getEffectiveConfig } from "./config.js";
import {
  persistPocketTtsBaseUrl,
  pocketTtsServeAttempts,
  pocketTtsSpawnOptions,
  resolvePocketTtsListenTarget,
} from "./tts/ensure-server.js";

async function waitForSpawn(child: ChildProcess, command: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onExit = (code: number | null) => {
      cleanup();
      reject(new Error(`${command} exited immediately with code ${code}`));
    };
    const timer = setTimeout(() => {
      cleanup();
      if (child.killed || child.exitCode !== null) {
        reject(new Error(`${command} exited immediately with code ${child.exitCode}`));
      } else {
        resolve();
      }
    }, 400);
    const cleanup = () => {
      clearTimeout(timer);
      child.removeListener("error", onError);
      child.removeListener("exit", onExit);
    };
    child.once("error", onError);
    child.once("exit", onExit);
  });
}

async function spawnForeground(
  host: string,
  port: number,
  language: string
): Promise<ChildProcess> {
  const attempts = pocketTtsServeAttempts(host, port, language);
  let lastError: unknown;

  for (const attempt of attempts) {
    try {
      const child = spawn(
        attempt.command,
        attempt.args,
        pocketTtsSpawnOptions("inherit", { windowsHide: false })
      );
      await waitForSpawn(child, attempt.command);
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

async function main(): Promise<void> {
  const config = getEffectiveConfig();
  const target = await resolvePocketTtsListenTarget(config.pocketTts);
  persistPocketTtsBaseUrl(target.baseUrl);

  if (target.alreadyRunning) {
    console.log(`Pocket TTS is already running at ${target.baseUrl}`);
    return;
  }

  console.log(`Starting Pocket TTS at ${target.baseUrl}`);
  const child = await spawnForeground(target.host, target.port, config.pocketTts.language || "english");

  const shutdown = () => {
    if (!child.killed) {
      child.kill();
    }
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  const code = await new Promise<number | null>((resolve) => {
    child.once("exit", (exitCode) => resolve(exitCode));
  });
  process.exit(code ?? 1);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
