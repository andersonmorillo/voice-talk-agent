import { ElevenLabsClient, play } from "@elevenlabs/elevenlabs-js";
import type { Config } from "../config.js";

export async function speakWithElevenLabs(config: Config, text: string): Promise<void> {
  if (!config.apiKey) {
    throw new Error(
      "ElevenLabs API key is not set. Add it in the settings UI or set ELEVENLABS_API_KEY."
    );
  }

  const client = new ElevenLabsClient({ apiKey: config.apiKey });
  const audio = await client.textToSpeech.convert(config.voiceId, {
    text,
    modelId: config.model,
    voiceSettings: {
      speed: config.voiceSettings.speed,
      stability: config.voiceSettings.stability,
      similarityBoost: config.voiceSettings.similarityBoost,
      style: config.voiceSettings.style,
    },
  });

  await play(audio);
}
