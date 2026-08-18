#!/usr/bin/env node

import express from "express";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { loadConfig, saveConfig, type Config, type TtsProvider } from "./config.js";
import { DEFAULT_SETTINGS_PORT, listenOnAvailablePort } from "./ports.js";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import {
  ensurePocketTtsServer,
  isPocketTtsHealthy,
  POCKET_TTS_LANGUAGES,
  POCKET_TTS_VOICES,
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
  const running = await isPocketTtsHealthy(config.pocketTts.baseUrl);
  res.json({
    running,
    baseUrl: config.pocketTts.baseUrl,
  });
});

app.post("/api/pocket-tts/start", async (_req, res) => {
  const config = loadConfig();
  try {
    const baseUrl = await ensurePocketTtsServer(config.pocketTts);
    res.json({
      success: true,
      running: true,
      baseUrl,
      message: `Pocket TTS is running at ${baseUrl}`,
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
        pocketTts: {
          ...config.pocketTts,
          ...(req.body.pocketTts || {}),
        },
      };
      await speak(testConfig, req.body.text || "Pocket TTS is working.");
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
