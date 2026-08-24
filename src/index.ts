#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getEffectiveConfig } from "./config.js";
import { speak, stopPlayback } from "./tts/index.js";
import { writeFileSync } from "fs";
import { basename, dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load config (config.json with env var overrides)
const config = getEffectiveConfig();

// Create server instance
const server = new McpServer({
  name: "cursor-tts",
  version: "1.0.0",
});

// TTS queue to prevent overlapping audio
interface TTSQueueItem {
  text: string;
  language?: string;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

const ttsQueue: TTSQueueItem[] = [];
let isProcessingQueue = false;

async function processTTSQueue() {
  if (isProcessingQueue || ttsQueue.length === 0) {
    return;
  }

  isProcessingQueue = true;

  while (ttsQueue.length > 0) {
    const item = ttsQueue.shift()!;

    try {
      const config = getEffectiveConfig();
      console.error(`[TTS] Speaking (${config.ttsProvider}${item.language ? `/${item.language}` : ""}): ${item.text}`);

      await speak(config, item.text, item.language);

      // Write TTS completion signal for background script
      const completionPath = join(__dirname, "..", "tts-complete.json");
      const completionSignal = {
        timestamp: new Date().toISOString(),
        completed: true,
      };
      writeFileSync(completionPath, JSON.stringify(completionSignal, null, 2), "utf-8");
      console.error(`[TTS] Playback complete, signal written: ${completionPath}`);

      item.resolve({
        content: [
          {
            type: "text",
            text: `Spoken: "${item.text}"`,
          },
        ],
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[TTS] Error: ${errorMessage}`);

      item.reject({
        content: [
          {
            type: "text",
            text: `Failed to speak: ${errorMessage}`,
          },
        ],
        isError: true,
      });
    }
  }

  isProcessingQueue = false;
}

function queueTTS(text: string, language?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    ttsQueue.push({ text, language, resolve, reject });
    processTTSQueue();
  });
}

function stopTTS(): number {
  const queuedCount = ttsQueue.length;
  while (ttsQueue.length > 0) {
    const item = ttsQueue.shift()!;
    item.resolve({
      content: [{ type: "text", text: "Speech cancelled before playback." }],
    });
  }
  stopPlayback();
  return queuedCount;
}

// Register the speak tool
server.registerTool(
  "speak",
  {
    description:
      "Speak text aloud using text-to-speech. Write the announcement in the same language you want spoken (Spanish or English). Use this to announce task progress, completions, and important updates so the user can follow along without looking at the screen.",
    inputSchema: {
      text: z
        .string()
        .describe("The text to speak aloud. Keep it concise (1-2 sentences max). Use Spanish or English to match the user."),
      language: z
        .enum(["auto", "english", "spanish", "en", "es"])
        .optional()
        .describe("Language of the text. Omit or auto to detect from the text. Use spanish or english when you know it."),
    },
  },
  async ({ text, language }) => {
    // Queue the TTS request to prevent overlapping audio
    return await queueTTS(text, language);
  }
);

// Register the stop-speaking tool
server.registerTool(
  "stop_speaking",
  {
    description:
      "Immediately stop current audio playback and cancel queued speech. Use when the user says stop speaking, be quiet, silence, or stop.",
    inputSchema: {},
  },
  async () => {
    const queuedCount = stopTTS();
    return {
      content: [
        {
          type: "text",
          text: `Speech stopped. Cancelled ${queuedCount} queued message${queuedCount === 1 ? "" : "s"}.`,
        },
      ],
    };
  }
);

// Register the current-project tool
server.registerTool(
  "current_project",
  {
    description:
      "Identify the project/workspace currently being used. Use when the user asks which project or agent workspace is active.",
    inputSchema: {
      projectPath: z
        .string()
        .optional()
        .describe("Optional workspace path supplied by the agent; defaults to the MCP process workspace."),
    },
  },
  async ({ projectPath }) => {
    const workspacePath = resolve(projectPath || process.cwd());
    let gitRoot = "";
    try {
      gitRoot = execFileSync("git", ["-C", workspacePath, "rev-parse", "--show-toplevel"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      // The workspace may not be a Git repository.
    }

    const projectName = basename(gitRoot || workspacePath);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              projectName,
              workspacePath,
              gitRoot: gitRoot || null,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// Register the listen tool
server.registerTool(
  "listen",
  {
    description:
      "Signal the background script to start listening for user voice input via Wispr Flow. Call this after speaking task completion to enable hands-free conversational loop.",
    inputSchema: {},
  },
  async () => {
    try {
      // Check if auto-listen is enabled
      if (!config.autoListen) {
        console.error(`[TTS] Auto-listen is disabled, skipping listen signal`);
        return {
          content: [
            {
              type: "text",
              text: "Auto-listen is disabled",
            },
          ],
        };
      }

      const signalPath = join(__dirname, "..", "listen-signal.json");
      const signal = {
        timestamp: new Date().toISOString(),
        triggered: true,
      };

      writeFileSync(signalPath, JSON.stringify(signal, null, 2), "utf-8");
      console.error(`[TTS] Listen signal written: ${signalPath}`);

      return {
        content: [
          {
            type: "text",
            text: "Listening for user input...",
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[TTS] Listen error: ${errorMessage}`);

      return {
        content: [
          {
            type: "text",
            text: `Failed to start listening: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Main function to start the server
async function main() {
  if (config.ttsProvider === "elevenlabs" && !config.apiKey) {
    console.error(
      "[TTS] ERROR: ElevenLabs is selected but no API key was found."
    );
    console.error("[TTS] Set ELEVENLABS_API_KEY, configure it in the settings UI, or switch to Pocket TTS.");
    console.error("[TTS] Run 'npm run settings' to open the settings UI.");
    process.exit(1);
  }

  console.error(`[TTS] Starting Cursor TTS MCP Server...`);
  console.error(`[TTS] Provider: ${config.ttsProvider}`);
  if (config.ttsProvider === "pocket-tts") {
    console.error(
      `[TTS] Pocket TTS speechLanguage=${config.pocketTts.speechLanguage} ` +
        `en=${config.pocketTts.english.voice}@${config.pocketTts.english.baseUrl} ` +
        `es=${config.pocketTts.spanish.voice}@${config.pocketTts.spanish.baseUrl}`
    );
  } else {
    console.error(`[TTS] Voice ID: ${config.voiceId}`);
    console.error(`[TTS] Model: ${config.model}`);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[TTS] Server running on stdio");
}

main().catch((error) => {
  console.error("[TTS] Fatal error in main():", error);
  process.exit(1);
});
