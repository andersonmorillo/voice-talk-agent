# Quick Setup Guide

Your Cursor TTS MCP server is fully built and configured. Default speech is **local Pocket TTS** (CPU, no API key). ElevenLabs is optional.

## Step 1: Install Pocket TTS

Install [uv](https://docs.astral.sh/uv/) (recommended) or run `pip install pocket-tts`.

Start the local server (first run downloads model weights):

```bash
npm run pocket-tts
```

Optional: leave auto-start enabled in the settings UI so the MCP starts this process when the agent speaks.

## Step 2 (optional): ElevenLabs

Only needed if you switch the provider to ElevenLabs in settings.

1. Get a key from https://try.elevenlabs.io/talktocursor
2. Open the settings UI (`npm run settings` → http://localhost:3847)
3. Select **ElevenLabs**, paste the key, click **Save API Key**

Or set environment variables:

```bash
export TTS_PROVIDER="elevenlabs"
export ELEVENLABS_API_KEY="sk_your_actual_api_key_here"
export ELEVENLABS_VOICE_ID="21m00Tcm4TlvDq8ikWAM"
```

For Pocket TTS overrides:

```bash
export TTS_PROVIDER="pocket-tts"
export POCKET_TTS_URL="http://127.0.0.1:8000"
export POCKET_TTS_VOICE="alba"
```

## Step 3: Restart Cursor

**Important**: Completely quit and restart Cursor for it to load the MCP server.

1. Press `Cmd+Q` to quit Cursor (or fully close it on Windows)
2. Reopen Cursor

## Step 4: Test It!

1. Open a new Cursor chat (Cmd+L)
2. Check "Available Tools" - you should see a "speak" tool
3. Type: **"Say hello using the speak tool"**
4. Listen for the voice through your speakers!

## Step 5: Try Voice-to-Voice Coding

1. Open Wispr Flow (for speech-to-text input)
2. Speak a coding request: "Refactor the login function"
3. The agent will narrate what it's doing as it works
4. Follow along hands-free!

## What's Been Configured

- **MCP Server**: built from this repo
- **Cursor Config**: `~/.cursor/mcp.json` (server registered)
- **Voice Rule**: `~/.cursor/rules/voice-feedback.mdc` (agent knows to speak)
- **Pocket TTS**: local CPU backend at `http://127.0.0.1:8000`

## Troubleshooting

**Tool doesn't appear?**
- Make sure you fully quit and restarted Cursor (Cmd+Q)
- Check the MCP config exists: `cat ~/.cursor/mcp.json`

**Pocket TTS not speaking?**
- Run `npm run pocket-tts` and wait for the first model download
- Use **Test Speak** in the settings UI
- Install `mpv` or ffmpeg (`ffplay`) for playback

**"API key not set" error?**
- That only happens when ElevenLabs is selected
- Switch to Pocket TTS, or save an ElevenLabs key in settings

**No audio?**
- Check system volume
- Test mpv: `mpv --version`

## Next Steps

- Browse Pocket TTS voices in the settings UI
- Optional: switch to ElevenLabs at https://try.elevenlabs.io/talktocursor
- Read the full README: `README.md`

Enjoy coding by voice!
