import type { Config, PocketTtsSettings } from "../config.js";
import { LEGACY_POCKET_TTS_PORT, parseListenAddress } from "../ports.js";
import { speakWithElevenLabs } from "./elevenlabs.js";
import { ensurePocketTtsServer } from "./ensure-server.js";
import { resolveSpeechLanguage, type SpeechLanguage } from "./language.js";
import { isPocketTtsHealthy, speakWithPocketTts } from "./pocket-tts.js";
import { stopPlayback } from "./play.js";

export function pocketSettingsForSpeech(
  config: Config,
  text: string,
  language?: string
): { settings: PocketTtsSettings; kind: SpeechLanguage; skipPorts: number[] } {
  const kind = resolveSpeechLanguage(text, language || config.pocketTts.speechLanguage);
  const profile = config.pocketTts[kind];
  const other = kind === "spanish" ? config.pocketTts.english : config.pocketTts.spanish;
  const settings: PocketTtsSettings = {
    ...config.pocketTts,
    baseUrl: profile.baseUrl,
    voice: profile.voice,
    language: profile.language,
  };
  return {
    settings,
    kind,
    skipPorts: [parseListenAddress(other.baseUrl).port, LEGACY_POCKET_TTS_PORT],
  };
}

async function speakWithLocalPocketTts(config: Config, text: string, language?: string): Promise<void> {
  const { settings, kind, skipPorts } = pocketSettingsForSpeech(config, text, language);
  console.error(
    `[TTS] Routing ${kind} speech to ${settings.baseUrl} ` +
      `(voice=${settings.voice} model=${settings.language} autoStart=${settings.autoStart})`
  );

  if (settings.autoStart) {
    await ensurePocketTtsServer(settings, { kind, skipPorts });
  } else if (!(await isPocketTtsHealthy(settings.baseUrl))) {
    throw new Error(
      `Pocket TTS is not running at ${settings.baseUrl}. Start it with: npm run pocket-tts`
    );
  }

  await speakWithPocketTts({ ...config, pocketTts: settings }, text);
}

export async function speak(config: Config, text: string, language?: string): Promise<void> {
  if (config.ttsProvider !== "elevenlabs") {
    await speakWithLocalPocketTts(config, text, language);
    return;
  }

  try {
    await speakWithElevenLabs(config, text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[TTS] ElevenLabs failed (${message}). Falling back to Pocket TTS.`);
    await speakWithLocalPocketTts(config, text, language);
  }
}

export { stopPlayback };

export { speakWithElevenLabs } from "./elevenlabs.js";
export { ensurePocketTtsServer } from "./ensure-server.js";
export {
  generatePocketTtsWav,
  isPocketTtsHealthy,
  POCKET_TTS_LANGUAGES,
  POCKET_TTS_VOICES,
  speakWithPocketTts,
} from "./pocket-tts.js";
export {
  detectSpeechLanguage,
  normalizeSpeechLanguage,
  resolveSpeechLanguage,
} from "./language.js";
export type { SpeechLanguage, SpeechLanguageMode } from "./language.js";
