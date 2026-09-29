import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, test } from "node:test";

import { artifactPath, projectDirectory, statePath } from "@/io/paths";
import { loadState } from "@/io/state-store";
import { sha256 } from "@/lib/hash";
import { RUN, runHook, setupRun } from "@tests/support/run-hook";

beforeEach(setupRun);

test("marks the owning agent done with the file hash and the writer", () => {
  const file = artifactPath(RUN, "02-weather-outlook.md");
  writeFileSync(file, "# Weather\n");
  runHook("post-write-state", { tool_name: "Write", agent_type: "weather-analyst", tool_input: { file_path: file } });
  const state = loadState(RUN);
  assert.equal(state.agents["weather-analyst"].status, "done");
  assert.equal(state.agents["weather-analyst"].sha256, sha256("# Weather\n"));
  assert.equal(state.log.at(-1)?.details.writer, "weather-analyst");
});

test("ignores files outside a run and runs without state", () => {
  const before = readFileSync(statePath(RUN), "utf8");
  const outside = path.join(projectDirectory(), "README.md");
  writeFileSync(outside, "x");
  assert.equal(runHook("post-write-state", { tool_name: "Write", tool_input: { file_path: outside } }).code, 0);
  const foreign = path.join(projectDirectory(), "runs", "other", "artifacts", "01-requirements.md");
  assert.equal(runHook("post-write-state", { tool_name: "Write", tool_input: { file_path: foreign } }).code, 0);
  assert.equal(readFileSync(statePath(RUN), "utf8"), before);
});
