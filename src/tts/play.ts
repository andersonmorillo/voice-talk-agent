import { spawn } from "child_process";
import { randomBytes } from "crypto";
import { unlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const isWindows = process.platform === "win32";
let activeChild: ReturnType<typeof spawn> | undefined;

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "ignore",
      shell: isWindows,
      windowsHide: true,
    });
    activeChild = child;
    child.on("error", reject);
    child.on("close", (code) => {
      if (activeChild === child) {
        activeChild = undefined;
      }
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

/** Stop the currently playing audio, if any. */
export function stopPlayback(): boolean {
  if (!activeChild) {
    return false;
  }

  activeChild.kill();
  activeChild = undefined;
  return true;
}

async function playWithMpv(filePath: string): Promise<void> {
  await run("mpv", ["--no-terminal", "--really-quiet", filePath]);
}

async function playWithFfplay(filePath: string): Promise<void> {
  await run("ffplay", ["-nodisp", "-autoexit", "-loglevel", "quiet", filePath]);
}

async function playWithPowerShell(filePath: string): Promise<void> {
  const escaped = filePath.replace(/'/g, "''");
  await run("powershell", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    `(New-Object System.Media.SoundPlayer '${escaped}').PlaySync()`,
  ]);
}

/**
 * Play a WAV buffer and wait until playback finishes.
 * Prefers mpv (same as the ElevenLabs SDK), then ffplay, then Windows SoundPlayer.
 */
export async function playWav(buffer: Buffer): Promise<void> {
  const filePath = join(tmpdir(), `talk-to-cursor-${randomBytes(8).toString("hex")}.wav`);
  await writeFile(filePath, buffer);

  const errors: string[] = [];
  try {
    for (const player of [playWithMpv, playWithFfplay, ...(isWindows ? [playWithPowerShell] : [])]) {
      try {
        await player(filePath);
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(message);
      }
    }
    throw new Error(
      `Could not play audio. Install mpv or ffmpeg (ffplay). Details: ${errors.join("; ")}`
    );
  } finally {
    await unlink(filePath).catch(() => undefined);
  }
}
