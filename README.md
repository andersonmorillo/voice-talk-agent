# TalkToCursor

**[talktocursor.com](https://talktocursor.com)**

A hands-free voice interface for Cursor AI. Your coding assistant speaks progress updates, completions, and responses aloud using local Pocket TTS (CPU) by default, with optional ElevenLabs cloud TTS.

## Features

- **Text-to-Speech** - Agent speaks aloud via local Pocket TTS (no API key, runs on CPU)
- **Optional ElevenLabs** - Switch to cloud TTS in the settings UI if you prefer
- **Settings UI** - Web interface to choose provider, voice, and speech parameters
- **Auto-Submit** - Optional: automatically press Enter when dictation finishes (hands-free)
- **Voice Presets** - ElevenLabs quick settings for fast, slow, expressive, stable, and dramatic speech
- **Configurable** - Pocket TTS voice/language, plus ElevenLabs speed, stability, similarity boost, and style



## Installation



### 1. Clone or download this repository

```bash
git clone https://github.com/MindSyncTech/cursor-tts-mcp.git
cd cursor-tts-mcp
```

Or download and extract the ZIP.

### 2. Install dependencies

```bash
npm install
```



### 3. Build the project

```bash
npm run build
```



### 4. Configure Cursor to use the MCP server

Edit (or create) `~/.cursor/mcp.json`:

```
{
  "mcpServers": {
    "tts": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/cursor-tts-mcp/build/index.js"]
    }
  }
}
```

**Important:** Replace `/ABSOLUTE/PATH/TO/cursor-tts-mcp` with the actual full path to where you cloned/downloaded this project.

For example:

- macOS/Linux: `/Users/yourname/cursor-tts-mcp/build/index.js`
- Windows: `C:\\Users\\yourname\\cursor-tts-mcp\\build\\index.js`



### 5. Install Pocket TTS (default, local, CPU)

Pocket TTS is the default provider. Install [uv](https://docs.astral.sh/uv/) (recommended) or `pip install pocket-tts`.

First run downloads model weights (one-time):

```bash
npm run pocket-tts
```

Leave that terminal open, or enable **Auto-start server** in the settings UI so the MCP starts it when the agent speaks.

Optional env overrides: `TTS_PROVIDER`, `POCKET_TTS_URL`, `POCKET_TTS_VOICE`.

### 6. Configure the MCP server

Open the settings UI:

```bash
npm run settings
```

Then open [http://localhost:3847](http://localhost:3847) in your browser and:

1. Confirm **Pocket TTS** is selected (default)
2. Choose a voice (default: `alba`) and click **Test Speak**
3. (Optional) Switch to **ElevenLabs**, paste an API key, and save
4. (Optional) Enable Auto-Submit if you want hands-free dictation



### 7. Restart Cursor

**Fully quit Cursor** (Cmd+Q on Mac, or close completely on Windows/Linux) and reopen it.

### 8. Test it

1. Open a new Cursor chat (Cmd+L)
2. Check that the `speak` or `user-tts-speak` tool appears in "Available Tools"
3. Type: **"Say hello using the speak tool"**
4. You should hear the voice through your speakers!



## Usage

Once installed, the Cursor AI agent will automatically speak at key moments:

- When starting a task
- When completing a task
- When encountering errors or needing clarification
- At major progress milestones

You can customize when the agent speaks by editing `~/.cursor/rules/voice-feedback.mdc`.

## Voice Settings

**Pocket TTS** (default): pick a catalog voice and language. No API key.

**ElevenLabs** (optional): the settings UI lets you adjust:

- **Speed** (0.7x - 1.2x) - How fast the speech is delivered
- **Stability** (0-1) - More consistent vs. more expressive
- **Similarity Boost** (0-1) - How closely it matches the original voice
- **Style Exaggeration** (0-1) - Amplifies the speaker's style (V2+ models)

**Quick Presets:**

- Default - Balanced settings
- Fast - Quick and energetic
- Slow - Clear and measured
- Expressive - Dynamic and varied
- Stable - Consistent tone
- Dramatic - Maximum style



## Auto-Submit (Optional)

For completely hands-free dictation:

1. Enable "Auto-Submit" in the settings UI
2. Adjust the silence delay (how long to wait after you stop speaking)
3. Save the settings
4. Run in a separate terminal:

```bash
npm run auto-submit
```

**Requirements:**

- macOS only (uses Accessibility API)
- Grant Accessibility permissions: System Settings > Privacy & Security > Accessibility > Add your terminal app

The script monitors the text field and automatically presses Enter when dictation finishes.

## Configuration Files

- `config.json` - Stores provider, Pocket TTS settings, optional ElevenLabs API key, and auto-submit preferences
- `~/.cursor/mcp.json` - Registers the MCP server with Cursor
- `~/.cursor/rules/voice-feedback.mdc` - Controls when the agent speaks



## Troubleshooting

**Tool doesn't appear in Cursor?**

- Make sure you fully quit and restarted Cursor (Cmd+Q)
- Check that `~/.cursor/mcp.json` has the correct absolute path
- Run `npm run build` to ensure the project is compiled

**Pocket TTS not speaking?**

- Run `npm run pocket-tts` and wait until the server is up (first run downloads weights)
- Or click **Start server** / **Test Speak** in the settings UI
- Install [uv](https://docs.astral.sh/uv/) so `uvx pocket-tts serve` works
- Install `mpv` or `ffmpeg` (ffplay) if playback fails

**"API key not set" error?**

- That only applies when ElevenLabs is selected
- Open the settings UI: `npm run settings`
- Switch back to Pocket TTS, or enter your ElevenLabs API key and click "Save API Key"
- Restart Cursor

**No audio?**

- Check system volume and speaker output
- Verify `mpv` is installed: `mpv --version`, or install ffmpeg for `ffplay`
- For Pocket TTS, use Test Speak in the settings UI
- For ElevenLabs, test your API key in the settings UI

**Auto-submit not working?**

- Ensure macOS Accessibility permissions are granted
- Check that Cursor is the frontmost app when dictating
- Adjust the "Min Text Length" if short dictations aren't triggering
- Increase "Silence Delay" if prompts are being submitted too early



## Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run settings` - Open the web settings UI
- `npm run pocket-tts` - Start the local Pocket TTS server
- `npm run auto-submit` - Start the auto-submit script (macOS only)



## Links

- **Website:** [talktocursor.com](https://talktocursor.com)
- **npm:** [npmjs.com/package/talktocursor](https://www.npmjs.com/package/talktocursor)



## License

MIT — see [LICENSE](LICENSE)

## Credits

- [Kyutai Pocket TTS](https://github.com/kyutai-labs/pocket-tts) for local CPU text-to-speech
- [ElevenLabs](https://try.elevenlabs.io/talktocursor) for optional cloud TTS
- [Model Context Protocol](https://modelcontextprotocol.io) for MCP SDK

