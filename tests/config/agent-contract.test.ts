import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { artifactOf } from "@/lib/dag-queries";
import { AGENT_NAMES } from "@/types/workflow";

const ROOT = process.cwd();
// Shell-written artifacts bypass post-write-state, so every artifact owner is told to use Write only.
const WRITE_ONLY = /Write the artifact \*\*only with the Write tool\*\*/;

test("the validator report follows the common artifact structure", () => {
  const prompt = readFileSync(path.join(ROOT, ".claude", "agents", "validator.md"), "utf8");
  const [, template = ""] = /## Report[^\n]*\n+```\n([\s\S]*?)\n```/.exec(prompt) ?? [];
  const headings = template.split("\n").filter((line) => line.startsWith("## "));
  assert.deepEqual(headings, [
    "## Meta",
    "## Summary",
    "## Gate results",
    "## Details",
    "## Sources",
    "## Open questions",
  ]);
});

test("every agent that owns an artifact must write it with the Write tool only", () => {
  for (const name of AGENT_NAMES.filter((agent) => artifactOf(agent) !== null)) {
    const prompt = readFileSync(path.join(ROOT, ".claude", "agents", `${name}.md`), "utf8");
    assert.match(prompt, WRITE_ONLY, name);
  }
});
