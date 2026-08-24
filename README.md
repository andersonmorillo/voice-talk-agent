# Talk to Cursor

A hands-free voice MCP for **Cursor**, **Claude Code**, and **OpenAI Codex**. The coding assistant speaks progress updates, completions, and responses aloud using local [Pocket TTS](https://github.com/kyutai-labs/pocket-tts) (CPU, no API key) by default, with optional ElevenLabs cloud TTS.

This repository is a derivative of [MindSyncTech/talk-to-cursor](https://github.com/MindSyncTech/talk-to-cursor) (Talk to Cursor by Mike Sheehan). See [License](#license). This fork adds local Pocket TTS and **Spanish + English** speech.

## Prerequisites

- [Node.js](https://nodejs.org/) 20 or newer
- At least one MCP client: [Cursor](https://cursor.com/), [Claude Code](https://code.claude.com/docs/en/quickstart), or [OpenAI Codex](https://developers.openai.com/codex)
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

## Configure agents

Build once, then register the same `build/index.js` MCP server with each client. From this repo:

```bash
npm run build
npm run setup-agents
```

`setup-agents` registers a **user-scope** `tts` server with Claude Code if the `claude` CLI is installed, writes `~/.codex/config.toml` for Codex, and allows the speak tools so they are not prompted every time.

Do **not** copy this repo into other projects. One global MCP entry per client is enough: every workspace shares the same MCP process and the same Pocket TTS server.

### Cursor

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

### Claude Code

This repo already includes a project-scoped [`.mcp.json`](.mcp.json) (Claude Code expands `${CLAUDE_PROJECT_DIR:-.}`). Voice instructions live in [`CLAUDE.md`](CLAUDE.md) and [`.claude/settings.json`](.claude/settings.json).

To use voice in **every** Claude Code project, register user scope (or run `npm run setup-agents`):

```bash
claude mcp add --scope user tts -- node /ABSOLUTE/PATH/TO/talk-to-cursor/build/index.js
```

On Windows PowerShell:

```powershell
claude mcp add --scope user tts -- node "$PWD\build\index.js"
```

Verify with `claude mcp list`. The first session in a folder may ask you to trust the project `.mcp.json` and allow `mcp__tts__speak`. Ask: **Say hello using the speak tool**.

See [Claude Code MCP](https://code.claude.com/docs/en/mcp) and the copy-paste example in [`examples/claude.mcp.json`](examples/claude.mcp.json).

### Codex

This repo includes a project-scoped [`.codex/config.toml`](.codex/config.toml). Codex loads it only for **trusted** projects. Voice instructions live in [`AGENTS.md`](AGENTS.md) (Codex reads this automatically).

To use voice in every Codex session, add the same block to `~/.codex/config.toml` (or run `npm run setup-agents`):

```toml
[mcp_servers.tts]
command = "node"
args = ["/ABSOLUTE/PATH/TO/talk-to-cursor/build/index.js"]
startup_timeout_sec = 20
tool_timeout_sec = 120
default_tools_approval_mode = "auto"
```

Then start Codex in this folder, trust the project if prompted, and run `/mcp` to confirm `tts` is connected. Ask it to say hello with `speak`.

See [Codex MCP](https://developers.openai.com/codex/mcp) and [`examples/codex.config.toml`](examples/codex.config.toml). `tool_timeout_sec` is 120s because the first Pocket TTS start (and playback) can exceed the 60s default.

## First speech

Install Pocket TTS once in your user tool dir so other projects never download it:

```bash
uv tool install pocket-tts
```

Pocket TTS auto-starts when the agent speaks (`pocketTts.autoStart` is true by default). The first run downloads model weights and can take a few minutes. Later projects reuse that install and, if the server is already up, they only call it over HTTP — no terminal, no extra package download.

It listens on port `18741` for English and `18742` for Spanish by default. If a port is taken, the next free port is used and saved to `config.json`.

To start the server yourself:

```bash
npm run pocket-tts
```

Optional settings UI:

```bash
npm run settings
```

Open [http://localhost:3847](http://localhost:3847), confirm **Pocket TTS**, pick English and Spanish voices, and click **Test English** / **Test Spanish**. If 3847 is already taken, the terminal prints the free port it chose instead.

## Spanish and English

Pocket TTS loads **one language model per server**, so this fork runs two local servers:

| Language | Voice | Model | Port |
|----------|-------|-------|------|
| English | `alba` | `english` | `18741` |
| Spanish | `lola` | `spanish_24l` | `18742` |

`pocketTts.speechLanguage` defaults to `auto`: the `speak` tool detects the language of the text and routes it to the matching server.

Lock to one language in `config.json`, the settings UI, or the environment:

```bash
POCKET_TTS_SPEECH_LANGUAGE=auto     # default: detect from text
# POCKET_TTS_SPEECH_LANGUAGE=english
# POCKET_TTS_SPEECH_LANGUAGE=spanish
POCKET_TTS_VOICE=alba
POCKET_TTS_LANGUAGE=english
POCKET_TTS_SPANISH_VOICE=lola
POCKET_TTS_SPANISH_LANGUAGE=spanish_24l
```

The first time each language is used, Pocket TTS downloads that model. After that, English and Spanish can be mixed in the same session.

Pass `language: "spanish"` or `language: "english"` to `speak` when you already know the language. The agent should speak in the same language the user is using.

ElevenLabs also works in both languages if you keep a multilingual model such as `eleven_flash_v2_5` or `eleven_multilingual_v2`. On the free API, use a **premade** voice (for example Jessica). Voice Library voices are rejected with HTTP 402.

## Test it

1. Open a new Cursor chat, a Claude Code session (`claude`), or Codex in this folder.
2. Check that the `speak` tool is available (`/mcp` in Claude Code and Codex).
3. Type: **Say hello using the speak tool** or **Di hola usando la herramienta speak**.
4. You should hear audio on your speakers.

The MCP server also provides:

- `current_project`: reports the active workspace and Git project name. The
  included Cursor rule and skill let you distinguish which agent is speaking when running concurrent projects.
- `stop_speaking`: immediately stops current playback and cancels queued
  speech. Say **"stop speaking"**, **"silence"**, or **"be quiet"**.

## Skills & Voice Feedback Modes

A dedicated Agent Skill is available at `.agents/skills/voice-feedback/SKILL.md` (Claude Code also loads `.claude/skills/voice-feedback/`):

1. **Project-Aware Mode**: Prefixes spoken updates with the active project name (e.g. `"[talk-to-cursor]: Finished build."`) so you can identify which agent/workspace is giving feedback when working on multiple projects in parallel.
2. **Direct Mode**: Speaks concisely without project prefixes for single-workspace tasks.

## Optional: voice feedback rule

- **Cursor:** copy [`examples/voice-feedback.mdc`](examples/voice-feedback.mdc) to `.cursor/rules/voice-feedback.mdc` (or `~/.cursor/rules/`).
- **Claude Code:** [`CLAUDE.md`](CLAUDE.md) and `.claude/skills/voice-feedback/` are already in the repo.
- **Codex:** [`AGENTS.md`](AGENTS.md) and `.agents/skills/voice-feedback/` are already in the repo.

## Optional: ElevenLabs

Switch the provider to ElevenLabs in the settings UI and paste an API key, or set:

```bash
TTS_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=your_api_key_here
ELEVENLABS_VOICE_ID=cgSgspJ2msm6clMCkdW9   # Jessica (premade)
```

Use a **premade** voice from your ElevenLabs account. The free API cannot use Voice Library voices (`402 paid_plan_required`). The old Rachel id `21m00Tcm4TlvDq8ikWAM` is a library voice and will fail on a free plan.

Premade voices are labeled English but speak Spanish with a multilingual model (`eleven_flash_v2_5` by default). Jessica is the example voice in this repo. Other premade ids that work the same way:

| Voice | ID |
|-------|-----|
| Jessica | `cgSgspJ2msm6clMCkdW9` |
| Sarah | `EXAVITQu4vr4xnSDxMaL` |
| Alice | `Xb7hH8MSUJpSbSDYk0k2` |
| George | `JBFqnCBsd6RMkjVDRZzb` |

If ElevenLabs fails (library voice, quota, or network), speech falls back to local Pocket TTS automatically.

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
| `pocketTts.baseUrl` | Local Pocket TTS server | `http://127.0.0.1:18741` |
| `pocketTts.speechLanguage` | `auto`, `english`, or `spanish` | `auto` |
| `pocketTts.english.voice` | English catalog voice | `alba` |
| `pocketTts.spanish.voice` | Spanish catalog voice | `lola` |
| `pocketTts.spanish.language` | Spanish model | `spanish_24l` |
| `pocketTts.autoStart` | Spawn the server if it is down | `true` |
| `apiKey` | Optional ElevenLabs API key | (empty) |
| `voiceId` | ElevenLabs voice id (premade on the free API) | `cgSgspJ2msm6clMCkdW9` (Jessica) |
| `model` | ElevenLabs model | `eleven_flash_v2_5` |
| `autoListen` | Auto-listen after tasks | `true` |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript |
| `npm run settings` | Settings UI (port 3847, or the next free port) |
| `npm run pocket-tts` | Start the local Pocket TTS server (English on 18741 by default) |
| `npm run install-tts` | Install Pocket TTS once with uv (`uv tool install pocket-tts`) |
| `npm run auto-submit` | Auto-submit + voice loop (macOS) |
| `npm run setup-agents` | Register the TTS MCP with Claude Code and Codex |
| `npm run mcp` | Run the MCP server on stdio (used by clients) |

## Troubleshooting

**Tool does not appear in Cursor / Claude Code / Codex**

- Run `npm run build`, then `npm run setup-agents`.
- Cursor: fully quit and restart. Check `~/.cursor/mcp.json` points at `build/index.js`.
- Claude Code: `claude mcp list`. Restart the CLI. Approve the project `.mcp.json` if asked.
- Codex: trust the project, then `/mcp`. Confirm `~/.codex/config.toml` or `.codex/config.toml` has `[mcp_servers.tts]`.
- Codex speak timeouts: keep `tool_timeout_sec = 120` (first Pocket TTS start can be slow).

**Pocket TTS not speaking**

- Run `npm run pocket-tts` and wait for the first model download.
- Install [uv](https://docs.astral.sh/uv/) and run `uv tool install pocket-tts` once so other projects do not download it again.
- Use **Test Speak** in the settings UI.
- The English server prefers port `18741` and Spanish prefers `18742`. If a port is busy, it moves to the next free port and stores it in `config.json`.
- If Spanish still sounds English, the English model is probably still bound to that port. Stop existing Pocket TTS processes and start again, or use **Start servers** in the settings UI.

**No audio**

- Check system volume.
- Install `mpv` or ffmpeg (`ffplay`) if Windows SoundPlayer is not enough.
- Confirm Pocket TTS is selected unless you intend to use ElevenLabs.

**ElevenLabs silent / `402 paid_plan_required`**

- Free accounts can only use **premade** voices via the API, not Voice Library voices.
- Set `voiceId` to a premade voice such as Jessica (`cgSgspJ2msm6clMCkdW9`).
- Keep `model` multilingual (`eleven_flash_v2_5` or `eleven_multilingual_v2`) for Spanish.
- If ElevenLabs still fails, the server falls back to Pocket TTS. Leave `pocketTts.autoStart` on so that fallback can start the local server.

**"API key not set"**

- That only applies when ElevenLabs is selected. Switch back to Pocket TTS, or save a key in the settings UI.

## License

MIT — see [LICENSE](LICENSE).

This project is a derivative of **[Talk to Cursor](https://github.com/MindSyncTech/talk-to-cursor)** by Mike Sheehan / [MindSyncTech](https://github.com/MindSyncTech), also published as [`talktocursor`](https://www.npmjs.com/package/talktocursor) and at [talktocursor.com](https://talktocursor.com/).

The original MIT copyright is retained:

- Copyright (c) 2026 Mike Sheehan
- Copyright (c) 2026 andersonmorillo (modifications in this fork: local Pocket TTS, Spanish and English speech, and related changes)

A copy of the original license text is included in [LICENSE](LICENSE).

## Credits

- [MindSyncTech/talk-to-cursor](https://github.com/MindSyncTech/talk-to-cursor) — original Talk to Cursor project by Mike Sheehan
- [Kyutai Pocket TTS](https://github.com/kyutai-labs/pocket-tts) for local CPU text-to-speech
- [ElevenLabs](https://elevenlabs.io) for optional cloud TTS
- [Model Context Protocol](https://modelcontextprotocol.io) for the MCP SDK
