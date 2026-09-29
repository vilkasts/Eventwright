import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { isRecord, listOf } from "@/lib/narrow";

const ROOT = process.cwd();
const HOOK_SCRIPT = /--import tsx "\$\{CLAUDE_PROJECT_DIR\}\/(\S+?\.ts)"/;
const WORKFLOW_EVENTS = ["PreToolUse", "PostToolUse", "UserPromptSubmit"];

const commandOf = (hook: unknown): string => (isRecord(hook) && typeof hook.command === "string" ? hook.command : "");

const hookCommands = (settings: unknown): Record<string, string[]> => {
  const hooks = isRecord(settings) && isRecord(settings.hooks) ? settings.hooks : {};
  return Object.fromEntries(
    Object.entries(hooks).map(([event, entries]) => [
      event,
      listOf(entries)
        .flatMap((entry) => (isRecord(entry) ? listOf(entry.hooks) : []))
        .map(commandOf),
    ]),
  );
};

test("cloud sessions install dependencies on start, local sessions skip it", () => {
  const settings: unknown = JSON.parse(readFileSync(path.join(ROOT, ".claude", "settings.json"), "utf8"));
  const [command = ""] = hookCommands(settings).SessionStart ?? [];
  assert.match(command, /CLAUDE_CODE_REMOTE" = "true"/);
  assert.match(command, /npm ci/);
});

test("settings.json registers every hook script through tsx", () => {
  const settings: unknown = JSON.parse(readFileSync(path.join(ROOT, ".claude", "settings.json"), "utf8"));
  const commands = hookCommands(settings);
  assert.equal(commands.PreToolUse?.length, 3);
  assert.equal(commands.PostToolUse?.length, 1);
  assert.equal(commands.UserPromptSubmit?.length, 1);
  for (const command of WORKFLOW_EVENTS.flatMap((event) => commands[event] ?? [])) {
    const [, script = ""] = HOOK_SCRIPT.exec(command) ?? [];
    assert.ok(existsSync(path.join(ROOT, script)), command);
  }
});

test("both project MCP servers are allowed without prompts", () => {
  const settings: unknown = JSON.parse(readFileSync(path.join(ROOT, ".claude", "settings.json"), "utf8"));
  const permissions = isRecord(settings) && isRecord(settings.permissions) ? settings.permissions : {};
  const allowed = listOf(permissions.allow);
  for (const server of ["mcp__open-meteo", "mcp__holidays"]) assert.ok(allowed.includes(server), server);
});
