import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT = process.cwd();

test("secrets are documented and excluded from git", () => {
  assert.ok(existsSync(path.join(ROOT, ".env.example")));
  const gitignore = readFileSync(path.join(ROOT, ".gitignore"), "utf8");
  assert.match(gitignore, /^\.env$/m);
  assert.match(gitignore, /^\.claude\/settings\.local\.json$/m);
});
