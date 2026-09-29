import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, test } from "node:test";

import { artifactPath, projectDirectory, statePath } from "@/io/paths";
import { loadState } from "@/io/state-store";
import { sha256 } from "@/lib/hash";
import { RUN, runHook, runHooksConcurrently, setupRun } from "@tests/support/run-hook";

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

test("concurrent writes of one parallel group are all recorded (no lost updates)", async () => {
  const PARALLEL_GROUP = [
    ["catering-planner", "04-catering.md"],
    ["entertainment-planner", "05-entertainment.md"],
    ["logistics-planner", "06-logistics.md"],
  ] as const;
  const ROUNDS = 6;
  for (let round = 0; round < ROUNDS; round += 1) {
    setupRun();
    const payloads = PARALLEL_GROUP.map(([agent, fileName]) => {
      const file = artifactPath(RUN, fileName);
      writeFileSync(file, `# ${agent} ${round}\n`);
      return { tool_name: "Write", agent_type: agent, tool_input: { file_path: file } };
    });
    const codes = await runHooksConcurrently("post-write-state", payloads);
    assert.deepEqual(codes, [0, 0, 0], `round ${round}: a hook crashed`);
    const state = loadState(RUN);
    for (const [agent] of PARALLEL_GROUP) assert.equal(state.agents[agent].status, "done", `round ${round}: ${agent}`);
  }
});

test("reports a corrupt state file to Claude instead of failing silently (F04)", () => {
  writeFileSync(statePath(RUN), "{ not json");
  const file = artifactPath(RUN, "02-weather-outlook.md");
  writeFileSync(file, "# Weather\n");
  const result = runHook("post-write-state", { tool_name: "Write", tool_input: { file_path: file } });
  assert.equal(result.code, 2);
  assert.match(result.stderr, /post-write-state/);
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
