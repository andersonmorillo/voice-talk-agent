import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  buildBaseUrl,
  DEFAULT_LISTEN_HOST,
  DEFAULT_POCKET_TTS_PORT,
  DEFAULT_SPANISH_POCKET_TTS_PORT,
} from "./ports.js";
import { normalizeSpeechLanguage, type SpeechLanguageMode } from "./tts/language.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export type TtsProvider = "pocket-tts" | "elevenlabs";

export interface VoiceSettings {
  speed: number;        // 0.7 - 1.2, default 1.0
  stability: number;    // 0.0 - 1.0, default 0.5
  similarityBoost: number; // 0.0 - 1.0, default 0.75
  style: number;        // 0.0 - 1.0, default 0.0 (V2+ models only)
}

export interface AutoSubmitSettings {
  enabled: boolean;
  silenceDelay: number;       // seconds after clipboard change before auto-submit (default 2.0)
  minTextLength: number;      // min chars in clipboard to count as dictation (default 10)
  targetApp: string;          // only auto-submit in this app (default "Cursor")
}

export interface WisprLoopSettings {
  enabled: boolean;
  ttsDelay: number;           // seconds to wait for TTS to finish before starting Wispr (default 4.0)
  silenceThreshold: number;   // RMS amplitude threshold for speech detection (default 0.02)
  silenceDuration: number;    // seconds of silence to confirm user stopped (default 2.0)
  wisprHotkey: string;        // hotkey combo to toggle Wispr (default "shift+ctrl")
  manualTriggerHotkey: string; // hotkey to manually start the loop (default "ctrl+shift+l")
}

export interface PocketTtsLanguageProfile {
  baseUrl: string;
  voice: string;
  language: string;
}

export interface PocketTtsSettings {
  baseUrl: string;
  voice: string;
  language: string;
  autoStart: boolean;
  /** auto = detect from spoken text; otherwise lock to one language. */
  speechLanguage: SpeechLanguageMode;
  english: PocketTtsLanguageProfile;
  spanish: PocketTtsLanguageProfile;
}

export interface Config {
  ttsProvider: TtsProvider;
  pocketTts: PocketTtsSettings;
  apiKey: string;
  voiceId: string;
  model: string;
  voiceSettings: VoiceSettings;
  volume: number;       // 0.0 - 2.0+ (default 1.0 = 100%)
  autoSubmit: AutoSubmitSettings;
  wisprLoop: WisprLoopSettings;
  autoListen: boolean; // automatically call listen() after task completion
}

const CONFIG_PATH = join(__dirname, "..", "config.json");

const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  speed: 1.0,
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0.0,
};

const DEFAULT_AUTO_SUBMIT: AutoSubmitSettings = {
  enabled: false,
  silenceDelay: 3.0,
  minTextLength: 15,
  targetApp: "Cursor",
};

const DEFAULT_WISPR_LOOP: WisprLoopSettings = {
  enabled: false,
  ttsDelay: 8.0,
  silenceThreshold: 0.02,
  silenceDuration: 2.0,
  wisprHotkey: "shift+ctrl",
  manualTriggerHotkey: "ctrl+shift+l",
};

export const DEFAULT_ENGLISH_PROFILE: PocketTtsLanguageProfile = {
  baseUrl: buildBaseUrl(DEFAULT_LISTEN_HOST, DEFAULT_POCKET_TTS_PORT),
  voice: "alba",
  language: "english",
};

export const DEFAULT_SPANISH_PROFILE: PocketTtsLanguageProfile = {
  baseUrl: buildBaseUrl(DEFAULT_LISTEN_HOST, DEFAULT_SPANISH_POCKET_TTS_PORT),
  voice: "lola",
  language: "spanish_24l",
};

export const DEFAULT_POCKET_TTS: PocketTtsSettings = {
  baseUrl: DEFAULT_ENGLISH_PROFILE.baseUrl,
  voice: DEFAULT_ENGLISH_PROFILE.voice,
  language: DEFAULT_ENGLISH_PROFILE.language,
  autoStart: true,
  speechLanguage: "auto",
  english: { ...DEFAULT_ENGLISH_PROFILE },
  spanish: { ...DEFAULT_SPANISH_PROFILE },
};

const DEFAULT_CONFIG: Config = {
  ttsProvider: "pocket-tts",
  pocketTts: { ...DEFAULT_POCKET_TTS, english: { ...DEFAULT_ENGLISH_PROFILE }, spanish: { ...DEFAULT_SPANISH_PROFILE } },
  apiKey: "",
  voiceId: "21m00Tcm4TlvDq8ikWAM",
  model: "eleven_flash_v2_5",
  voiceSettings: { ...DEFAULT_VOICE_SETTINGS },
  volume: 1.0,
  autoSubmit: { ...DEFAULT_AUTO_SUBMIT },
  wisprLoop: { ...DEFAULT_WISPR_LOOP },
  autoListen: true,
};

function parseProvider(value: unknown): TtsProvider {
  if (typeof value === "string" && value.toLowerCase() === "elevenlabs") {
    return "elevenlabs";
  }
  return "pocket-tts";
}

function mergeProfile(
  defaults: PocketTtsLanguageProfile,
  parsed?: Partial<PocketTtsLanguageProfile>
): PocketTtsLanguageProfile {
  return {
    ...defaults,
    ...(parsed || {}),
  };
}

export function mergePocketTts(parsed?: Partial<PocketTtsSettings>): PocketTtsSettings {
  const english = mergeProfile(DEFAULT_ENGLISH_PROFILE, parsed?.english);
  const spanish = mergeProfile(DEFAULT_SPANISH_PROFILE, parsed?.spanish);
  return {
    ...DEFAULT_POCKET_TTS,
    ...(parsed || {}),
    speechLanguage: normalizeSpeechLanguage(parsed?.speechLanguage ?? DEFAULT_POCKET_TTS.speechLanguage),
    english,
    spanish,
    baseUrl: parsed?.baseUrl || english.baseUrl,
    voice: parsed?.voice || english.voice,
    language: parsed?.language || english.language,
    autoStart: parsed?.autoStart !== undefined ? parsed.autoStart : DEFAULT_POCKET_TTS.autoStart,
  };
}

function mergeConfig(parsed: Partial<Config> = {}): Config {
  return {
    ...DEFAULT_CONFIG,
    ...parsed,
    volume: typeof parsed.volume === "number" && !isNaN(parsed.volume) ? parsed.volume : DEFAULT_CONFIG.volume,
    ttsProvider: parseProvider(parsed.ttsProvider ?? DEFAULT_CONFIG.ttsProvider),
    pocketTts: mergePocketTts(parsed.pocketTts),
    voiceSettings: {
      ...DEFAULT_VOICE_SETTINGS,
      ...(parsed.voiceSettings || {}),
    },
    autoSubmit: {
      ...DEFAULT_AUTO_SUBMIT,
      ...(parsed.autoSubmit || {}),
    },
    wisprLoop: {
      ...DEFAULT_WISPR_LOOP,
      ...(parsed.wisprLoop || {}),
    },
    autoListen: parsed.autoListen !== undefined ? parsed.autoListen : DEFAULT_CONFIG.autoListen,
  };
}

export function loadConfig(): Config {
  try {
    if (existsSync(CONFIG_PATH)) {
      const raw = readFileSync(CONFIG_PATH, "utf-8");
      return mergeConfig(JSON.parse(raw));
    }
  } catch (error) {
    console.error("[Config] Error reading config.json:", error);
  }
  return mergeConfig();
}

export function saveConfig(config: Partial<Config>): Config {
  const current = loadConfig();
  const updated = mergeConfig({
    ...current,
    ...config,
    volume: config.volume !== undefined ? config.volume : current.volume,
    pocketTts: mergePocketTts({
      ...current.pocketTts,
      ...(config.pocketTts || {}),
      english: {
        ...current.pocketTts.english,
        ...(config.pocketTts?.english || {}),
      },
      spanish: {
        ...current.pocketTts.spanish,
        ...(config.pocketTts?.spanish || {}),
      },
    }),
    voiceSettings: {
      ...current.voiceSettings,
      ...(config.voiceSettings || {}),
    },
    autoSubmit: {
      ...current.autoSubmit,
      ...(config.autoSubmit || {}),
    },
    wisprLoop: {
      ...current.wisprLoop,
      ...(config.wisprLoop || {}),
    },
  });
  writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2), "utf-8");
  return updated;
}

function applyPocketTtsEnv(fileConfig: PocketTtsSettings): PocketTtsSettings {
  const english: PocketTtsLanguageProfile = {
    ...fileConfig.english,
    baseUrl: process.env.POCKET_TTS_URL || fileConfig.english.baseUrl,
    voice: process.env.POCKET_TTS_VOICE || fileConfig.english.voice,
    language: process.env.POCKET_TTS_LANGUAGE || fileConfig.english.language,
  };
  const spanish: PocketTtsLanguageProfile = {
    ...fileConfig.spanish,
    baseUrl: process.env.POCKET_TTS_SPANISH_URL || fileConfig.spanish.baseUrl,
    voice: process.env.POCKET_TTS_SPANISH_VOICE || fileConfig.spanish.voice,
    language: process.env.POCKET_TTS_SPANISH_LANGUAGE || fileConfig.spanish.language,
  };

  return mergePocketTts({
    ...fileConfig,
    speechLanguage: normalizeSpeechLanguage(
      process.env.POCKET_TTS_SPEECH_LANGUAGE || fileConfig.speechLanguage
    ),
    english,
    spanish,
    baseUrl: english.baseUrl,
    voice: english.voice,
    language: english.language,
  });
}

export function getEffectiveConfig(): Config {
  const fileConfig = loadConfig();
  const envVolume = process.env.TTS_VOLUME ? parseFloat(process.env.TTS_VOLUME) : undefined;

  return {
    ...fileConfig,
    ttsProvider: parseProvider(process.env.TTS_PROVIDER || fileConfig.ttsProvider),
    pocketTts: applyPocketTtsEnv(fileConfig.pocketTts),
    apiKey: process.env.ELEVENLABS_API_KEY || fileConfig.apiKey,
    voiceId: process.env.ELEVENLABS_VOICE_ID || fileConfig.voiceId,
    model: fileConfig.model || DEFAULT_CONFIG.model,
    volume: envVolume !== undefined && !isNaN(envVolume) ? envVolume : fileConfig.volume,
  };
}
