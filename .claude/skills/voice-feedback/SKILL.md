---
name: voice-feedback
description: Speaks agent replies aloud via the TTS MCP speak tool. Use when the user wants voice feedback, talking out loud, or hands-free updates.
---

# Voice feedback

Call the MCP `speak` tool (`mcp__tts__speak` in Claude Code) on every user-facing reply.

## Required

1. Speak the core answer in 1–2 sentences.
2. Match the user's language (Spanish or English). Pass `language: "spanish"` or `language: "english"` when known.
3. Announce task start and completion. Summarize errors briefly.
4. Still write the full answer in chat.

## Do not

- Skip speaking because the reply is short
- Speak code, file dumps, or long lists
- Wait until a long task ends to speak the first time
