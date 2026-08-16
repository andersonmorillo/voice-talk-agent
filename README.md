# Talk to Cursor

A hands-free voice interface for Cursor AI. The coding assistant speaks progress updates, completions, and responses aloud using local [Pocket TTS](https://github.com/kyutai-labs/pocket-tts) (CPU, no API key) by default, with optional ElevenLabs cloud TTS.

## Prerequisites

- [Node.js](https://nodejs.org/) 20 or newer
- [Cursor](https://cursor.com/)
- [uv](https://docs.astral.sh/uv/) (recommended) or `pip install pocket-tts`

Playback works with `mpv`, `ffplay` (ffmpeg), or the built-in Windows SoundPlayer. On Windows you usually do not need extra audio tools.

## Install

```bash
git clone <this-repo>
cd talk-to-cursor
npm install
npm run build
```

Copy the example config if you want a local file to edit (optional — defaults work without it):

```bash
cp config.example.json config.json
```

On Windows PowerShell:

```powershell
Copy-Item config.example.json config.json
```

Do not commit `config.json` or `.env`. They can hold API keys.

## Configure Cursor

Edit or create `~/.cursor/mcp.json` (Windows: `%USERPROFILE%\.cursor\mcp.json`):

```json
{
  "mcpServers": {
    "tts": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/talk-to-cursor/build/index.js"]
    }
  }
}
```

Replace the path with the real location of this project:

- macOS / Linux: `/Users/yourname/talk-to-cursor/build/index.js`
- Windows: `C:\\Users\\yourname\\talk-to-cursor\\build\\index.js`

Fully quit Cursor and reopen it so the MCP server loads.

## First speech

Pocket TTS auto-starts when the agent speaks (`pocketTts.autoStart` is true by default). The first run downloads model weights and can take a few minutes.

To start the server yourself:

```bash
npm run pocket-tts
```

Optional settings UI:

```bash
npm run settings
```

Open [http://localhost:3847](http://localhost:3847), confirm **Pocket TTS**, pick a voice, and click **Test Speak**.

Spanish voices: use catalog voice `lola` and language `spanish_24l` in the settings UI or `config.json`.

## Test it

1. Open a new Cursor chat.
2. Check that the `speak` tool appears under Available Tools.
3. Type: **Say hello using the speak tool**.
4. You should hear audio on your speakers.

The MCP server also provides:

- `current_project`: reports the active workspace and Git project name. The
  included Cursor rule and skill let you distinguish which agent is speaking when running concurrent projects.
- `stop_speaking`: immediately stops current playback and cancels queued
  speech. Say **"stop speaking"**, **"silence"**, or **"be quiet"**.

## Skills & Voice Feedback Modes

A dedicated Agent Skill is available at `.cursor/skills/voice-feedback/SKILL.md` (and globally in `~/.cursor/skills/voice-feedback/`):

1. **Project-Aware Mode**: Prefixes spoken updates with the active project name (e.g. `"[talk-to-cursor]: Finished build."`) so you can identify which agent/workspace is giving feedback when working on multiple projects in parallel.
2. **Direct Mode**: Speaks concisely without project prefixes for single-workspace tasks.

## Optional: voice feedback rule

Copy [`examples/voice-feedback.mdc`](examples/voice-feedback.mdc) to `.cursor/rules/voice-feedback.mdc` in this project (or into `~/.cursor/rules/`) so the agent speaks at task start and completion.

## Optional: ElevenLabs

Switch the provider to ElevenLabs in the settings UI and paste an API key, or set:

```bash
TTS_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=your_api_key_here
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
```

See [`.env.example`](.env.example). Environment variables override `config.json`.

## Optional: auto-submit (macOS only)

Uses the macOS Accessibility API to press Enter after dictation.

1. Enable Auto-Submit in the settings UI.
2. Create a venv and install dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install pynput pyobjc-framework-ApplicationServices
```

3. Run:

```bash
npm run auto-submit
```

4. Grant Accessibility permission to your terminal (System Settings → Privacy & Security → Accessibility).

Wispr Flow loop additionally needs `sounddevice`, `numpy`, PortAudio, and Microphone permission.

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `ttsProvider` | `pocket-tts` or `elevenlabs` | `pocket-tts` |
| `pocketTts.baseUrl` | Local Pocket TTS server | `http://127.0.0.1:8000` |
| `pocketTts.voice` | Catalog voice | `alba` |
| `pocketTts.language` | Language model | `english` |
| `pocketTts.autoStart` | Spawn the server if it is down | `true` |
| `apiKey` | Optional ElevenLabs API key | (empty) |
| `autoListen` | Auto-listen after tasks | `true` |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript |
| `npm run settings` | Settings UI on port 3847 |
| `npm run pocket-tts` | Start the local Pocket TTS server |
| `npm run auto-submit` | Auto-submit + voice loop (macOS) |

## Troubleshooting

**Tool does not appear in Cursor**

- Fully quit and restart Cursor.
- Check that `mcp.json` uses the correct absolute path to `build/index.js`.
- Run `npm run build`.

**Pocket TTS not speaking**

- Run `npm run pocket-tts` and wait for the first model download.
- Install [uv](https://docs.astral.sh/uv/) so `uvx pocket-tts serve` works.
- Use **Test Speak** in the settings UI.

**No audio**

- Check system volume.
- Install `mpv` or ffmpeg (`ffplay`) if Windows SoundPlayer is not enough.
- Confirm Pocket TTS is selected unless you intend to use ElevenLabs.

**"API key not set"**

- That only applies when ElevenLabs is selected. Switch back to Pocket TTS, or save a key in the settings UI.

## License

MIT — see [LICENSE](LICENSE). Original copyright retained.

## Credits

- [Kyutai Pocket TTS](https://github.com/kyutai-labs/pocket-tts) for local CPU text-to-speech
- [ElevenLabs](https://elevenlabs.io) for optional cloud TTS
- [Model Context Protocol](https://modelcontextprotocol.io) for the MCP SDK
