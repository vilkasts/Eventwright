import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT = process.cwd();
const COORDINATOR_MODEL = "sonnet";
// Every entry point that runs the coordinator loop; the override lasts only for the current turn.
const COORDINATOR_FILES = [
  ".claude/commands/plan-event.md",
  ".claude/commands/resume-event.md",
  ".claude/commands/approve-event.md",
  ".claude/commands/reject-event.md",
  ".claude/skills/workflow-orchestration/SKILL.md",
];

const frontmatterOf = (file: string): string => {
  const [, frontmatter = ""] = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(path.join(ROOT, file), "utf8")) ?? [];
  return frontmatter;
};

test("the coordinator runs on Sonnet regardless of the session model", () => {
  for (const file of COORDINATOR_FILES) {
    assert.match(frontmatterOf(file), new RegExp(`^model: ${COORDINATOR_MODEL}$`, "m"), file);
  }
});
