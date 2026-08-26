# Voice feedback

This project exposes a local MCP server named `tts` with a `speak` tool. Use it in Cursor, Claude Code, and Codex. The tool is always `speak` regardless of how the client names the server (`user-tts` in Cursor, `mcp__tts__speak` in Claude Code).

## Modes

Pick a speech mode from context (see `.agents/skills/voice-feedback/SKILL.md`):

### Mode 1: Project-aware (multi-project)

When multiple Cursor windows or projects run concurrently, or the user asks which workspace is speaking:

1. Call `current_project` (or use the workspace basename).
2. Prefix spoken text: `"[Project Name]: Starting …"` / `"…: <milestone>"` / `"…: Finished …"`.

### Mode 2: Direct (single project)

Otherwise call `speak` without a project prefix.

## Required

On **every** user-facing reply, call `speak` with the main point of the answer.

- Speak in the same language as the user (Spanish or English).
- Keep spoken text to 1–2 sentences. Pass `language: "spanish"` or `language: "english"` when you know it; otherwise `auto`.
- Announce task start, important progress, completion, and errors.
- Still write the full answer in chat. Do not speak code, file dumps, or long lists.
- If the user says stop, silence, or be quiet, call `stop_speaking`.
- After a hands-free Wispr Flow loop, call `listen` when the task is done.

Do not skip speaking because the reply is short or because another client named the server differently.
