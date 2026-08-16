import type { Config, PocketTtsSettings } from "../config.js";
import { playWav } from "./play.js";

export const POCKET_TTS_VOICES = [
  { id: "alba", name: "Alba", language: "English" },
  { id: "anna", name: "Anna", language: "English" },
  { id: "azelma", name: "Azelma", language: "English" },
  { id: "bill_boerst", name: "Bill Boerst", language: "English" },
  { id: "caro_davy", name: "Caro Davy", language: "English" },
  { id: "charles", name: "Charles", language: "English" },
  { id: "cosette", name: "Cosette", language: "English" },
  { id: "eponine", name: "Eponine", language: "English" },
  { id: "eve", name: "Eve", language: "English" },
  { id: "fantine", name: "Fantine", language: "English" },
  { id: "george", name: "George", language: "English" },
  { id: "jane", name: "Jane", language: "English" },
  { id: "jean", name: "Jean", language: "English" },
  { id: "javert", name: "Javert", language: "English" },
  { id: "marius", name: "Marius", language: "English" },
  { id: "mary", name: "Mary", language: "English" },
  { id: "michael", name: "Michael", language: "English" },
  { id: "paul", name: "Paul", language: "English" },
  { id: "peter_yearsley", name: "Peter Yearsley", language: "English" },
  { id: "stuart_bell", name: "Stuart Bell", language: "English" },
  { id: "vera", name: "Vera", language: "English" },
  { id: "estelle", name: "Estelle", language: "French" },
  { id: "juergen", name: "Juergen", language: "German" },
  { id: "giovanni", name: "Giovanni", language: "Italian" },
  { id: "rafael", name: "Rafael", language: "Portuguese" },
  { id: "lola", name: "Lola", language: "Spanish" },
] as const;

export const POCKET_TTS_LANGUAGES = [
  { id: "english", name: "English" },
  { id: "english_2026-04", name: "English (2026-04)" },
  { id: "spanish_24l", name: "Spanish" },
  { id: "french_24l", name: "French" },
  { id: "german_24l", name: "German" },
  { id: "portuguese_24l", name: "Portuguese" },
  { id: "italian_24l", name: "Italian" },
] as const;

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export async function isPocketTtsHealthy(baseUrl: string, timeoutMs = 2000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(normalizeBaseUrl(baseUrl) + "/", {
      method: "GET",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function generatePocketTtsWav(
  settings: PocketTtsSettings,
  text: string
): Promise<Buffer> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Text cannot be empty");
  }

  const form = new FormData();
  form.append("text", trimmed);
  form.append("voice_url", settings.voice || "alba");

  const response = await fetch(`${normalizeBaseUrl(settings.baseUrl)}/tts`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Pocket TTS request failed (${response.status}): ${detail || response.statusText}`
    );
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function speakWithPocketTts(config: Config, text: string): Promise<void> {
  const wav = await generatePocketTtsWav(config.pocketTts, text);
  await playWav(wav, config.volume);
}
