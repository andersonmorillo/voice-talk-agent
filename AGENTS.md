# Voice feedback

This project exposes a local MCP server named `tts` with a `speak` tool. Use it in Cursor, Claude Code, and Codex.

## Required

On **every** user-facing reply, call `speak` with the main point of the answer.

- Speak in the same language as the user (Spanish or English).
- Keep spoken text to 1–2 sentences. Pass `language: "spanish"` or `language: "english"` when you know it; otherwise `auto`.
- Announce task start, important progress, completion, and errors.
- Still write the full answer in chat. Do not speak code, file dumps, or long lists.
- If the user says stop, silence, or be quiet, call `stop_speaking`.

Do not skip speaking because the reply is short or because another client (Cursor vs Claude Code vs Codex) named the server differently. The tool is always `speak`.
