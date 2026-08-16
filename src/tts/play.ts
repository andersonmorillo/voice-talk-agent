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
 * Applies digital volume gain to 16-bit PCM WAV audio.
 * Multiplier: 1.0 = 100%, 1.5 = 150%, 2.0 = 200%, etc.
 */
export function applyVolumeGain(buffer: Buffer, volume = 1.0): Buffer {
  if (volume === 1.0 || volume <= 0) {
    return buffer;
  }

  const out = Buffer.from(buffer);
  const dataTag = Buffer.from("data");
  const dataIndex = out.indexOf(dataTag);
  if (dataIndex === -1 || dataIndex + 8 > out.length) {
    return out;
  }

  const startOffset = dataIndex + 8;
  for (let i = startOffset; i + 1 < out.length; i += 2) {
    const sample = out.readInt16LE(i);
    const amplified = Math.max(-32768, Math.min(32767, Math.round(sample * volume)));
    out.writeInt16LE(amplified, i);
  }

  return out;
}

/**
 * Play a WAV buffer and wait until playback finishes.
 * Prefers mpv (same as the ElevenLabs SDK), then ffplay, then Windows SoundPlayer.
 */
export async function playWav(buffer: Buffer, volume = 1.0): Promise<void> {
  const processedBuffer = volume !== 1.0 ? applyVolumeGain(buffer, volume) : buffer;
  const filePath = join(tmpdir(), `talk-to-cursor-${randomBytes(8).toString("hex")}.wav`);
  await writeFile(filePath, processedBuffer);

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
