#!/usr/bin/env node

import express from "express";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { loadConfig, saveConfig, mergePocketTts, type Config, type TtsProvider } from "./config.js";
import { DEFAULT_SETTINGS_PORT, listenOnAvailablePort } from "./ports.js";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import {
  ensurePocketTtsServer,
  isPocketTtsHealthy,
  POCKET_TTS_LANGUAGES,
  POCKET_TTS_VOICES,
  pocketSettingsForSpeech,
  speak,
} from "./tts/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());

// Serve static files from /public
app.use(express.static(join(__dirname, "..", "public")));

function publicConfig(config: Config) {
  return {
    ttsProvider: config.ttsProvider,
    pocketTts: config.pocketTts,
    apiKey: config.apiKey ? maskKey(config.apiKey) : "",
    apiKeySet: !!config.apiKey,
    voiceId: config.voiceId,
    model: config.model,
    voiceSettings: config.voiceSettings,
    volume: config.volume ?? 1.0,
    autoSubmit: config.autoSubmit,
    wisprLoop: config.wisprLoop,
    autoListen: config.autoListen,
  };
}

// GET /api/config - return current config (mask API key)
app.get("/api/config", (_req, res) => {
  res.json(publicConfig(loadConfig()));
});

// POST /api/config - save config
app.post("/api/config", (req, res) => {
  const {
    ttsProvider,
    pocketTts,
    apiKey,
    voiceId,
    model,
    voiceSettings,
    volume,
    autoSubmit,
    wisprLoop,
    autoListen,
  } = req.body;

  const updates: Record<string, unknown> = {};
  if (ttsProvider !== undefined) updates.ttsProvider = ttsProvider as TtsProvider;
  if (pocketTts !== undefined) updates.pocketTts = pocketTts;
  if (apiKey !== undefined && apiKey !== "") updates.apiKey = apiKey;
  if (voiceId !== undefined) updates.voiceId = voiceId;
  if (model !== undefined) updates.model = model;
  if (voiceSettings !== undefined) updates.voiceSettings = voiceSettings;
  if (volume !== undefined) updates.volume = typeof volume === "number" ? volume : parseFloat(volume);
  if (autoSubmit !== undefined) updates.autoSubmit = autoSubmit;
  if (wisprLoop !== undefined) updates.wisprLoop = wisprLoop;
  if (autoListen !== undefined) updates.autoListen = autoListen;

  const saved = saveConfig(updates);
  res.json({
    success: true,
    config: publicConfig(saved),
  });
});

app.get("/api/pocket-tts/voices", (_req, res) => {
  res.json({
    voices: POCKET_TTS_VOICES,
    languages: POCKET_TTS_LANGUAGES,
  });
});

app.get("/api/pocket-tts/status", async (_req, res) => {
  const config = loadConfig();
  const englishUrl = config.pocketTts.english.baseUrl;
  const spanishUrl = config.pocketTts.spanish.baseUrl;
  const [english, spanish] = await Promise.all([
    isPocketTtsHealthy(englishUrl),
    isPocketTtsHealthy(spanishUrl),
  ]);
  res.json({
    running: english || spanish,
    baseUrl: config.pocketTts.baseUrl,
    english: { running: english, baseUrl: englishUrl },
    spanish: { running: spanish, baseUrl: spanishUrl },
  });
});

app.post("/api/pocket-tts/start", async (req, res) => {
  const config = loadConfig();
  const requested = typeof req.body?.language === "string" ? req.body.language : "both";
  try {
    const started: Array<{ language: string; baseUrl: string }> = [];
    const kinds = requested === "spanish"
      ? (["spanish"] as const)
      : requested === "english"
        ? (["english"] as const)
        : (["english", "spanish"] as const);

    for (const kind of kinds) {
      const sample = kind === "spanish" ? "Hola" : "Hello";
      const { settings, skipPorts } = pocketSettingsForSpeech(config, sample, kind);
      const baseUrl = await ensurePocketTtsServer(settings, { kind, skipPorts });
      started.push({ language: kind, baseUrl });
    }

    res.json({
      success: true,
      running: true,
      started,
      baseUrl: started[0]?.baseUrl,
      message: started.map((item) => `${item.language} at ${item.baseUrl}`).join("; "),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(400).json({ error: msg, running: false });
  }
});

// POST /api/test - test TTS with current config
app.post("/api/test", async (req, res) => {
  const config = loadConfig();
  const provider: TtsProvider = req.body.ttsProvider || config.ttsProvider;

  if (provider === "pocket-tts") {
    try {
      const testConfig = {
        ...config,
        ttsProvider: "pocket-tts" as const,
        volume: req.body.volume !== undefined ? parseFloat(req.body.volume) : config.volume,
        pocketTts: mergePocketTts({
          ...config.pocketTts,
          ...(req.body.pocketTts || {}),
          english: {
            ...config.pocketTts.english,
            ...(req.body.pocketTts?.english || {}),
          },
          spanish: {
            ...config.pocketTts.spanish,
            ...(req.body.pocketTts?.spanish || {}),
          },
        }),
      };
      await speak(
        testConfig,
        req.body.text || (req.body.language === "spanish" ? "Pocket TTS está funcionando." : "Pocket TTS is working."),
        req.body.language
      );
      res.json({
        success: true,
        message: `Spoke using Pocket TTS voice "${testConfig.pocketTts.voice}".`,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(400).json({ error: `Pocket TTS test failed: ${msg}` });
    }
    return;
  }

  const apiKey = req.body.apiKey || config.apiKey;

  if (!apiKey) {
    res.status(400).json({ error: "No API key configured" });
    return;
  }

  try {
    const client = new ElevenLabsClient({ apiKey });
    // Verify the key works by fetching voices
    const voices = await client.voices.getAll();
    res.json({
      success: true,
      message: `API key is valid! Found ${voices.voices.length} voices.`,
      voices: voices.voices.map((v) => ({
        id: v.voiceId,
        name: v.name,
        category: v.category,
        preview_url: v.previewUrl,
      })),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(400).json({ error: `API key test failed: ${msg}` });
  }
});

// POST /api/voices - list available voices
app.post("/api/voices", async (req, res) => {
  const config = loadConfig();
  const apiKey = req.body.apiKey || config.apiKey;

  if (!apiKey) {
    res.status(400).json({ error: "No API key configured" });
    return;
  }

  try {
    const client = new ElevenLabsClient({ apiKey });
    const voices = await client.voices.getAll();
    res.json({
      voices: voices.voices.map((v) => ({
        id: v.voiceId,
        name: v.name,
        category: v.category,
        preview_url: v.previewUrl,
        labels: v.labels,
      })),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(400).json({ error: msg });
  }
});

function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

async function main(): Promise<void> {
  const requestedPort = parseInt(process.env.PORT || String(DEFAULT_SETTINGS_PORT), 10);
  const { port } = await listenOnAvailablePort(
    (listenPort, callback) => app.listen(listenPort, callback),
    requestedPort
  );

  console.log(`\n  Cursor TTS Settings UI`);
  console.log(`  ───────────────────────`);
  if (Number.isFinite(requestedPort) && port !== requestedPort) {
    console.log(`  Port ${requestedPort} is in use; using ${port} instead`);
  }
  console.log(`  Open http://localhost:${port} in your browser\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to start settings UI: ${message}`);
  process.exit(1);
});
