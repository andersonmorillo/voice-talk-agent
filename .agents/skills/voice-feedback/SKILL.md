---
name: voice-feedback
description: Provide voice feedback using MCP text-to-speech (speak tool). Supports two execution modes: (1) Project-aware mode to prefix updates with the current project/workspace name when running concurrent projects, and (2) Direct mode for standard concise spoken feedback. Use when the user requests voice feedback, speaks to Cursor, or asks to run tasks with spoken progress across single or multiple projects.
---

# Voice Feedback (Talk to Cursor)

This skill enables spoken audio progress and status updates via the TTS MCP server (`speak`, `current_project`, `listen`, `stop_speaking`).

The tool is always `speak` regardless of client. Cursor: `user-tts`. Claude Code: `tts` (`mcp__tts__speak`, `mcp__tts__current_project`, `mcp__tts__listen`, `mcp__tts__stop_speaking`). Codex: `speak`.

It is designed to support multitasking across multiple Cursor projects or single-project workflows seamlessly.

---

## The Two Execution Modes

When interacting or responding to tasks, determine the required speech mode based on user instructions or runtime context:

### Mode 1: Project-Aware Voice Feedback (Multi-Project Context)
**Use when:**
- The user runs multiple Cursor windows/projects concurrently.
- The user asks to include project names or distinguish which agent/workspace is speaking.
- Multiple tasks run in parallel across repositories.

**Workflow:**
1. Call `current_project` (or inspect workspace basename if unavailable).
2. Note the active project name (e.g., `talk-to-cursor`, `my-web-app`, `backend-api`).
3. Prefix every spoken announcement with the project name or tag:
   - **Start format**: `"[Project Name]: Starting <task summary>."`
   - **Progress format**: `"[Project Name]: <Milestone reached>."`
   - **Completion format**: `"[Project Name]: Finished <summary>."`
4. Keep the spoken text concise (1-2 sentences maximum).

**Example:**
- Spoken start: *"talk-to-cursor: Building TypeScript bundle and verifying MCP server."*
- Spoken finish: *"talk-to-cursor: Build succeeded and test suite passed."*

---

### Mode 2: Direct Voice Feedback (Single-Project / Concise)
**Use when:**
- The user is focusing on a single workspace or does not need repository prefixing.
- The user prefers clean, direct voice updates without workspace tags.

**Workflow:**
1. Call `speak` directly without project prefixes.
2. Announce:
   - **Task Start**: What you are about to do.
   - **Key Milestones**: Critical intermediate steps.
   - **Task Completion**: Concise summary of what was completed or resolved.
3. Keep the spoken text concise (1-2 sentences maximum).

**Example:**
- Spoken start: *"Starting the migration script and updating database tables."*
- Spoken finish: *"Migration completed successfully."*

---

## Tool Reference

| Tool | Purpose | Example Usage |
|------|---------|---------------|
| `speak` | Speaks text aloud using text-to-speech. | `speak({ text: "talk-to-cursor: Tests passed." })` |
| `current_project` | Detects workspace and Git repo name. | `current_project({})` |
| `stop_speaking` | Halts current audio playback and clears speech queue. | `stop_speaking({})` |
| `listen` | Signals background listener (Wispr Flow loop) after task ends. | `listen({})` |

---

## Best Practices & Guidelines

1. **Concise Speech**: Text-to-speech takes real time to listen to. Keep messages under 2 sentences.
2. **Audio-first Milestones**:
   - Speak at the start of substantial work.
   - Speak upon finishing all requested work.
   - Speak when encountering blocking errors requiring user decision.
3. **Language Matching**: Speak in the language the user is communicating in (e.g., Spanish if user prompts in Spanish, English if prompting in English).
4. **Hands-free Loop**: If running a hands-free voice loop with Wispr Flow, call `listen` after announcing task completion.
5. **Chat vs speech**: Write the full answer in chat. Do not speak code, file dumps, or long lists. Do not skip speaking because the reply is short.
