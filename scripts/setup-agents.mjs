#!/usr/bin/env node
/**
 * Register the local TTS MCP server with Claude Code and/or Codex.
 * Run from the repo root: npm run setup-agents
 */
import { spawnSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mcpJs = join(root, "build", "index.js");
const isWin = process.platform === "win32";

function run(command, args, opts = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    stdio: "pipe",
    shell: isWin,
    ...opts,
  });
}

function commandExists(name) {
  const probe = isWin ? "where" : "which";
  const result = run(probe, [name]);
  return result.status === 0;
}

function ensureBuild() {
  if (existsSync(mcpJs)) {
    return;
  }
  console.log("[setup-agents] build/index.js missing — running npm run build");
  const result = spawnSync("npm", ["run", "build"], {
    cwd: root,
    stdio: "inherit",
    shell: isWin,
  });
  if (result.status !== 0) {
    throw new Error("npm run build failed");
  }
}

function mergeClaudeUserSettings() {
  const dir = join(homedir(), ".claude");
  const path = join(dir, "settings.json");
  mkdirSync(dir, { recursive: true });

  let settings = {};
  if (existsSync(path)) {
    try {
      settings = JSON.parse(readFileSync(path, "utf8"));
    } catch {
      console.warn("[setup-agents] Could not parse ~/.claude/settings.json; leaving it unchanged");
      return;
    }
  }

  const allow = new Set(settings.permissions?.allow || []);
  for (const tool of [
    "mcp__tts__speak",
    "mcp__tts__stop_speaking",
    "mcp__tts__current_project",
    "mcp__tts__listen",
  ]) {
    allow.add(tool);
  }

  settings.permissions = {
    ...(settings.permissions || {}),
    allow: [...allow],
  };
  writeFileSync(path, JSON.stringify(settings, null, 2) + "\n", "utf8");
  console.log("[setup-agents] Allowed TTS tools in ~/.claude/settings.json");
}

function ensureClaudeUserInstructions() {
  const path = join(homedir(), ".claude", "CLAUDE.md");
  const marker = "tts MCP speak";
  const block = [
    "",
    "## Voice (TTS MCP)",
    "",
    "A local MCP server named `tts` is registered. Call `speak` (`mcp__tts__speak`) on every user-facing reply: 1–2 sentences, same language as the user. Announce start, progress, completion, and errors. Call `stop_speaking` if the user asks for silence.",
    "",
  ].join("\n");

  if (!existsSync(path)) {
    writeFileSync(
      path,
      `# User instructions\n${block}`,
      "utf8"
    );
    console.log("[setup-agents] Wrote ~/.claude/CLAUDE.md with voice instructions");
    return;
  }

  const current = readFileSync(path, "utf8");
  if (current.includes(marker) || current.includes("mcp__tts__speak")) {
    console.log("[setup-agents] ~/.claude/CLAUDE.md already has TTS instructions");
    return;
  }
  writeFileSync(path, current.trimEnd() + "\n" + block, "utf8");
  console.log("[setup-agents] Appended voice instructions to ~/.claude/CLAUDE.md");
}

function registerClaude() {
  if (!commandExists("claude")) {
    console.log("[setup-agents] Claude Code CLI not found — skip user-scope MCP");
    console.log("  Install: https://code.claude.com/docs/en/quickstart");
    console.log("  Then re-run: npm run setup-agents");
    return false;
  }

  const listed = run("claude", ["mcp", "list"]);
  const listing = `${listed.stdout || ""}\n${listed.stderr || ""}`;
  const hasUserScope = /user config/i.test(listing) && /\btts\b/i.test(listing);

  if (hasUserScope) {
    console.log("[setup-agents] Claude Code already has user-scope MCP server tts");
  } else {
    const added = spawnSync(
      "claude",
      ["mcp", "add", "--scope", "user", "tts", "--", "node", mcpJs],
      { cwd: root, stdio: "inherit", shell: isWin }
    );
    if (added.status !== 0) {
      console.warn("[setup-agents] claude mcp add --scope user failed (project .mcp.json may still apply in this repo)");
    } else {
      console.log("[setup-agents] Registered tts with Claude Code (user scope)");
    }
  }

  mergeClaudeUserSettings();
  ensureClaudeUserInstructions();
  return true;
}

function upsertCodexToml(path) {
  mkdirSync(dirname(path), { recursive: true });
  const block = [
    "",
    "[mcp_servers.tts]",
    `command = "node"`,
    `args = [${JSON.stringify(mcpJs)}]`,
    "startup_timeout_sec = 20",
    "tool_timeout_sec = 120",
    'default_tools_approval_mode = "auto"',
    "",
  ].join("\n");

  if (!existsSync(path)) {
    writeFileSync(path, `# Added by talk-to-cursor setup-agents\n${block.trimStart()}`, "utf8");
    return "wrote";
  }

  const current = readFileSync(path, "utf8");
  if (/\[mcp_servers\.tts\]/.test(current)) {
    return "exists";
  }
  writeFileSync(path, current.trimEnd() + "\n" + block, "utf8");
  return "appended";
}

function registerCodex() {
  const userToml = join(homedir(), ".codex", "config.toml");

  if (commandExists("codex")) {
    const added = spawnSync(
      "codex",
      ["mcp", "add", "tts", "--", "node", mcpJs],
      { cwd: root, stdio: "inherit", shell: isWin }
    );
    if (added.status === 0) {
      console.log("[setup-agents] Registered tts with Codex CLI");
      return true;
    }
    console.warn("[setup-agents] codex mcp add failed — writing ~/.codex/config.toml instead");
  } else {
    console.log("[setup-agents] Codex CLI not found — writing ~/.codex/config.toml for when you install it");
    console.log("  Install: https://developers.openai.com/codex");
  }

  const result = upsertCodexToml(userToml);
  if (result === "exists") {
    console.log("[setup-agents] ~/.codex/config.toml already has [mcp_servers.tts]");
  } else {
    console.log(`[setup-agents] ${result} [mcp_servers.tts] in ~/.codex/config.toml`);
  }
  return true;
}

function main() {
  console.log(`[setup-agents] Project: ${root}`);
  console.log(`[setup-agents] MCP entry: node ${mcpJs}`);
  ensureBuild();
  const claude = registerClaude();
  const codex = registerCodex();
  console.log("");
  console.log("[setup-agents] Done.");
  if (claude) {
    console.log("  Claude Code: restart the CLI/IDE, then ask it to say hello with speak.");
  }
  if (codex) {
    console.log("  Codex: trust this project if prompted, then run /mcp inside a session.");
  }
}

try {
  main();
} catch (error) {
  console.error("[setup-agents] Failed:", error instanceof Error ? error.message : error);
  process.exit(1);
}
