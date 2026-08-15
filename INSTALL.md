# TalkToCursor - Installation Guide

**[talktocursor.com](https://talktocursor.com)** | **[npm](https://www.npmjs.com/package/talktocursor)** | **[GitHub](https://github.com/MindSyncTech/cursor-tts-mcp)**

A hands-free voice interface for Cursor AI. Your coding assistant speaks progress updates aloud using local Pocket TTS by default, with optional ElevenLabs cloud TTS.

---

## Quick Install (via npm)

```bash
npm install -g talktocursor
```

Then add to your Cursor MCP config (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "tts": {
      "command": "npx",
      "args": ["-y", "talktocursor"]
    }
  }
}
```

Skip to [Step 3: Install Pocket TTS](#step-3-install-pocket-tts).

---

## Manual Install (from source)

### Step 1: Download and extract

**Option A** - From tar.gz:
```bash
tar -xzf talk-to-cursor.tar.gz
cd cursor-tts-mcp
```

**Option B** - From GitHub:
```bash
git clone https://github.com/MindSyncTech/cursor-tts-mcp.git
cd cursor-tts-mcp
```

### Step 2: Install dependencies and build

```bash
npm install
npm run build
```

Then add to your Cursor MCP config (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "tts": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/cursor-tts-mcp/build/index.js"]
    }
  }
}
```

> **Important:** Replace `/ABSOLUTE/PATH/TO/cursor-tts-mcp` with the actual path on your machine.
>
> - macOS/Linux: `/Users/yourname/cursor-tts-mcp/build/index.js`
> - Windows: `C:\\Users\\yourname\\cursor-tts-mcp\\build\\index.js`

---

## Step 3: Install Pocket TTS

Pocket TTS is the default provider. It runs locally on CPU and does not need an API key.

1. Install [uv](https://docs.astral.sh/uv/) (recommended) or `pip install pocket-tts`
2. Start the server (first run downloads model weights):

```bash
npm run pocket-tts
```

## Step 4: Configure via Settings UI

```bash
npm run settings
```

Open **http://localhost:3847** in your browser, then:

1. Confirm **Pocket TTS** is selected
2. Choose a voice and click **Test Speak**
3. (Optional) Switch to **ElevenLabs**, paste an API key, and click **Save API Key**
4. (Optional) Enable Auto-Listen for hands-free voice loop

> **Alternatively**, set provider via environment variables in MCP config:
> ```json
> {
>   "mcpServers": {
>     "tts": {
>       "command": "npx",
>       "args": ["-y", "talktocursor"],
>       "env": {
>         "TTS_PROVIDER": "pocket-tts",
>         "POCKET_TTS_VOICE": "alba"
>       }
>     }
>   }
> }
> ```

## Step 5: Restart Cursor

**Fully quit Cursor** (Cmd+Q on Mac) and reopen it. The MCP server needs a fresh restart to load.

## Step 6: Test it

1. Open a new Cursor chat (Cmd+L)
2. Check that the `speak` tool appears in "Available Tools"
3. Type: **"Say hello using the speak tool"**
4. You should hear the voice through your speakers!

---

## Optional: Voice Feedback Rule

For the best experience, create a Cursor rule so the agent automatically speaks at key moments.

Create the file `~/.cursor/rules/voice-feedback.mdc`:

```markdown
---
description: MANDATORY voice feedback - agent MUST speak at task start and completion
alwaysApply: true
---

# Voice Feedback Rule

You MUST use the `speak` tool at these moments:
- **Task Start**: Briefly announce what you're about to do
- **Task Completion**: Summarize what was done

Keep messages concise (1-2 sentences). Always speak at start and end of every task.
```

---

## Optional: Hands-Free Dictation (macOS only)

For a fully hands-free experience with voice dictation:

### Auto-Submit Setup

1. Enable **Auto-Submit** in the settings UI
2. Set up a Python virtual environment:

```bash
cd cursor-tts-mcp
python3 -m venv .venv
source .venv/bin/activate
pip install pynput pyobjc-framework-ApplicationServices
```

3. Run in a separate terminal:

```bash
npm run auto-submit
```

4. Grant Accessibility permissions when prompted:
   - System Settings > Privacy & Security > Accessibility
   - Add your terminal app (Terminal.app, iTerm, or Cursor)

### Wispr Voice Loop Setup (requires Wispr Flow)

For a full conversational voice loop using [Wispr Flow](https://ref.wisprflow.ai/talktocursor):

1. Install Wispr Flow and configure its dictation hotkey
2. Enable **Wispr Voice Loop** in the settings UI
3. Configure the hotkey to match your Wispr Flow settings
4. Install additional Python dependency:

```bash
source .venv/bin/activate
pip install sounddevice numpy
brew install portaudio
```

5. Grant Microphone permissions to your terminal app
6. Run the auto-submit script (handles both auto-submit and voice loop):

```bash
npm run auto-submit
```

---

## Configuration

All settings are stored in `config.json` in the project root. You can edit this directly or use the settings UI.

| Setting | Description | Default |
|---------|-------------|---------|
| `ttsProvider` | `pocket-tts` or `elevenlabs` | `pocket-tts` |
| `pocketTts.baseUrl` | Local Pocket TTS server | `http://127.0.0.1:8000` |
| `pocketTts.voice` | Pocket TTS catalog voice | `alba` |
| `pocketTts.language` | Pocket TTS language model | `english` |
| `pocketTts.autoStart` | Spawn the local server if it is down | true |
| `apiKey` | Optional ElevenLabs API key | (empty) |
| `voiceId` | ElevenLabs voice ID | Rachel |
| `model` | ElevenLabs TTS model | `eleven_flash_v2_5` |
| `voiceSettings.speed` | Speech speed (0.7-1.2) | 1.0 |
| `voiceSettings.stability` | Voice stability (0-1) | 0.5 |
| `voiceSettings.similarityBoost` | Voice similarity (0-1) | 0.75 |
| `voiceSettings.style` | Style exaggeration (0-1) | 0.0 |
| `autoListen` | Auto-listen after tasks | true |
| `autoSubmit.enabled` | Auto-press Enter | false |
| `wisprLoop.enabled` | Voice loop with Wispr | false |

---

## Troubleshooting

### Tool doesn't appear in Cursor
- Fully quit and restart Cursor (Cmd+Q)
- Verify `~/.cursor/mcp.json` has the correct path
- Run `npm run build` to ensure the project is compiled

### Pocket TTS not speaking
- Run `npm run pocket-tts` and wait for the first model download
- Use **Test Speak** in the settings UI
- Install [uv](https://docs.astral.sh/uv/) so `uvx pocket-tts serve` works

### "API key not set" error
- This only applies when ElevenLabs is selected
- Switch to Pocket TTS, or open settings and save an ElevenLabs key
- Restart Cursor

### No audio output
- Check system volume and speaker output
- Verify `mpv` is installed, or install ffmpeg for `ffplay`
- For Pocket TTS, use Test Speak in the settings UI

### Auto-submit not working
- Ensure macOS Accessibility permissions are granted
- Check that Cursor is the frontmost app
- Try increasing the silence delay in settings

---

## Scripts Reference

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript |
| `npm run settings` | Open settings UI (port 3847) |
| `npm run pocket-tts` | Start the local Pocket TTS server |
| `npm run auto-submit` | Start auto-submit + voice loop (macOS) |

---

## License

MIT
