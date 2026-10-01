import assert from "node:assert/strict";
import { mkdir, readFile, rm, stat, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { pathToFileURL } from "url";

const LOCK_DIR = join(tmpdir(), "talk-to-cursor-playback.lock");
const STALE_WITHOUT_PID_MS = 2000;

let cancelGeneration = 0;

export function shouldStealPlaybackLock(input: {
  pid: number | null;
  alive: boolean;
  ageMs: number;
}): boolean {
  if (input.pid == null) {
    return input.ageMs >= STALE_WITHOUT_PID_MS;
  }
  return !input.alive;
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function stealIfStale(): Promise<boolean> {
  let pid: number | null = null;
  let ageMs = Number.POSITIVE_INFINITY;
  try {
    const raw = Number(await readFile(join(LOCK_DIR, "pid"), "utf8"));
    pid = Number.isInteger(raw) && raw > 0 ? raw : null;
  } catch {
    pid = null;
  }
  try {
    ageMs = Date.now() - (await stat(LOCK_DIR)).mtimeMs;
  } catch {
    return true;
  }
  if (!shouldStealPlaybackLock({ pid, alive: pid != null && isPidAlive(pid), ageMs })) {
    return false;
  }
  await rm(LOCK_DIR, { recursive: true, force: true });
  return true;
}

async function acquire(isCancelled: () => boolean): Promise<boolean> {
  for (;;) {
    if (isCancelled()) {
      return false;
    }
    try {
      await mkdir(LOCK_DIR);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
      if (await stealIfStale()) {
        continue;
      }
      await sleep(200);
      continue;
    }

    try {
      await writeFile(join(LOCK_DIR, "pid"), String(process.pid));
    } catch (error) {
      await rm(LOCK_DIR, { recursive: true, force: true }).catch(() => undefined);
      throw error;
    }
    if (isCancelled()) {
      await release();
      return false;
    }
    return true;
  }
}

async function release(): Promise<void> {
  try {
    const pid = Number(await readFile(join(LOCK_DIR, "pid"), "utf8"));
    if (pid !== process.pid) {
      return;
    }
    await rm(LOCK_DIR, { recursive: true, force: true });
  } catch {
    // Another process already took or removed the lock.
  }
}

/** Drop a wait for the speaker. Does not stop audio that is already playing. */
export function cancelPlaybackLockWait(): void {
  cancelGeneration += 1;
}

/**
 * Run playback only while this process holds the machine-wide speaker lock.
 * ponytail: directory lock in the temp folder. A crashed holder is stolen when its pid is dead.
 * A hung holder keeps the speaker until that process exits.
 */
export async function withPlaybackLock(play: () => Promise<void>): Promise<void> {
  const ticket = cancelGeneration;
  const held = await acquire(() => cancelGeneration !== ticket);
  if (!held) {
    return;
  }
  try {
    await play();
  } finally {
    await release();
  }
}

function check() {
  assert.equal(shouldStealPlaybackLock({ pid: 10, alive: true, ageMs: 10_000 }), false);
  assert.equal(shouldStealPlaybackLock({ pid: 10, alive: false, ageMs: 0 }), true);
  assert.equal(shouldStealPlaybackLock({ pid: null, alive: false, ageMs: 500 }), false);
  assert.equal(shouldStealPlaybackLock({ pid: null, alive: false, ageMs: 2000 }), true);
}

const isMain = Boolean(process.argv[1]) && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  check();
  console.log("playback-lock ok");
}
