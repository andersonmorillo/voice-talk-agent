import type { Config } from "../config.js";
import { speakWithElevenLabs } from "./elevenlabs.js";
import { ensurePocketTtsServer } from "./ensure-server.js";
import { isPocketTtsHealthy, speakWithPocketTts } from "./pocket-tts.js";
import { stopPlayback } from "./play.js";

export async function speak(config: Config, text: string): Promise<void> {
  if (config.ttsProvider === "elevenlabs") {
    await speakWithElevenLabs(config, text);
    return;
  }

  if (config.pocketTts.autoStart) {
    await ensurePocketTtsServer(config.pocketTts);
  } else if (!(await isPocketTtsHealthy(config.pocketTts.baseUrl))) {
    throw new Error(
      `Pocket TTS is not running at ${config.pocketTts.baseUrl}. Start it with: npm run pocket-tts`
    );
  }

  await speakWithPocketTts(config, text);
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
