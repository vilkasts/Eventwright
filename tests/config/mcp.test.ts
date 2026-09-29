import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT = process.cwd();
const WEATHER_ENTRY = "node_modules/open-meteo-mcp-server/dist/index.js";
const HOLIDAYS_ENTRY = "node_modules/@pipeworx/mcp-holidays/bin/cli.js";

test("both MCP servers live in .claude/mcp.json and start from node_modules (no npx)", () => {
  const config: unknown = JSON.parse(readFileSync(path.join(ROOT, ".claude", "mcp.json"), "utf8"));
  assert.deepEqual(config, {
    mcpServers: {
      "open-meteo": { type: "stdio", command: "node", args: [WEATHER_ENTRY] },
      holidays: { type: "stdio", command: "node", args: [HOLIDAYS_ENTRY] },
    },
  });
  for (const entry of [WEATHER_ENTRY, HOLIDAYS_ENTRY]) assert.ok(existsSync(path.join(ROOT, entry)), entry);
});

test("MCP servers are pinned to exact versions in package.json", () => {
  const manifest: unknown = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const text = JSON.stringify(manifest);
  assert.match(text, /"open-meteo-mcp-server":"\d+\.\d+\.\d+"/);
  assert.match(text, /"@pipeworx\/mcp-holidays":"\d+\.\d+\.\d+"/);
});

test("npm run claude loads the MCP config from .claude/", () => {
  const manifest: unknown = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.match(JSON.stringify(manifest), /"claude":"claude --mcp-config=\.claude\/mcp\.json"/);
});
