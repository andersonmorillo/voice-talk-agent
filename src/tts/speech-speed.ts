import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const MIN_SPEECH_SPEED = 0.5;
export const MAX_SPEECH_SPEED = 2;
export const MIN_ELEVENLABS_SPEED = 0.7;
export const MAX_ELEVENLABS_SPEED = 1.2;

export function clampSpeechSpeed(
  speed: unknown,
  min = MIN_SPEECH_SPEED,
  max = MAX_SPEECH_SPEED
): number {
  const n = typeof speed === "number" ? speed : Number(speed);
  if (!Number.isFinite(n)) {
    return 1;
  }
  return Math.min(max, Math.max(min, n));
}

export function clampElevenLabsSpeed(speed: unknown): number {
  return clampSpeechSpeed(speed, MIN_ELEVENLABS_SPEED, MAX_ELEVENLABS_SPEED);
}

/** Speeds playback by rewriting the WAV sample rate. Pitch shifts with speed. */
export function scaleWavSampleRate(buffer: Buffer, speed: number): Buffer {
  if (speed === 1 || !Number.isFinite(speed) || speed <= 0) {
    return buffer;
  }
  if (buffer.length < 32 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    return buffer;
  }

  const out = Buffer.from(buffer);
  out.writeUInt32LE(Math.max(1, Math.round(out.readUInt32LE(24) * speed)), 24);
  out.writeUInt32LE(Math.max(1, Math.round(out.readUInt32LE(28) * speed)), 28);
  return out;
}

function check() {
  assert.equal(clampSpeechSpeed(1), 1);
  assert.equal(clampSpeechSpeed(0.1), 0.5);
  assert.equal(clampSpeechSpeed(9), 2);
  assert.equal(clampSpeechSpeed("1.5"), 1.5);
  assert.equal(clampSpeechSpeed("nope"), 1);
  assert.equal(clampElevenLabsSpeed(2), 1.2);
  assert.equal(clampElevenLabsSpeed(0.2), 0.7);

  const wav = Buffer.alloc(44);
  wav.write("RIFF", 0);
  wav.write("WAVE", 8);
  wav.writeUInt32LE(24000, 24);
  wav.writeUInt32LE(48000, 28);
  const faster = scaleWavSampleRate(wav, 2);
  assert.equal(faster.readUInt32LE(24), 48000);
  assert.equal(faster.readUInt32LE(28), 96000);
}

const isMain = Boolean(process.argv[1]) && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  check();
  console.log("speech-speed ok");
}
