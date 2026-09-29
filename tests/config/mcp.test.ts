import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT = process.cwd();
const SERVER_ENTRY = "node_modules/open-meteo-mcp-server/dist/index.js";

test("the open-meteo MCP server lives in .claude/mcp.json and starts from node_modules (no npx)", () => {
  const config: unknown = JSON.parse(readFileSync(path.join(ROOT, ".claude", "mcp.json"), "utf8"));
  assert.deepEqual(config, {
    mcpServers: { "open-meteo": { type: "stdio", command: "node", args: [SERVER_ENTRY] } },
  });
  assert.ok(existsSync(path.join(ROOT, SERVER_ENTRY)), SERVER_ENTRY);
});

test("npm run claude loads the MCP config from .claude/", () => {
  const manifest: unknown = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.match(JSON.stringify(manifest), /"claude":"claude --mcp-config=\.claude\/mcp\.json"/);
});
