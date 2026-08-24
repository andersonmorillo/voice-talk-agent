@AGENTS.md

# Claude Code

The TTS MCP server is configured in `.mcp.json` as `tts`. Tools appear as `mcp__tts__speak`, `mcp__tts__stop_speaking`, `mcp__tts__current_project`, and `mcp__tts__listen`.

Call `speak` on every user-facing reply. Permissions for those tools are allowed in `.claude/settings.json`.
