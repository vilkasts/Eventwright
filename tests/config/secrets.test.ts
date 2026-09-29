import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT = process.cwd();

test("secrets are documented in the README and excluded from git", () => {
  assert.match(readFileSync(path.join(ROOT, "README.md"), "utf8"), /^## Environment and secrets$/m);
  const gitignore = readFileSync(path.join(ROOT, ".gitignore"), "utf8");
  assert.match(gitignore, /^\.env$/m);
  assert.match(gitignore, /^\.env\.\*$/m);
  assert.match(gitignore, /^\.claude\/settings\.local\.json$/m);
});
