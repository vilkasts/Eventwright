import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { artifactPath, statePath } from "@/io/paths";
import { RUN, runHook, setupRun, writePayload } from "@tests/support/run-hook";

beforeEach(setupRun);

test("denies a direct state write with the PreToolUse JSON contract", () => {
  const result = runHook("state-integrity-guard", writePayload(statePath(RUN), "{}"));
  assert.equal(result.code, 0);
  assert.equal(result.decision, "deny");
  assert.match(result.stdout, /workflow-state\.json/);
});

test("allows everything else silently", () => {
  const result = runHook("state-integrity-guard", {
    tool_name: "Bash",
    tool_input: { command: `npm run -s wf -- next ${RUN}` },
  });
  assert.equal(result.code, 0);
  assert.equal(result.stdout, "");
});

test("denies a write to another agent's artifact and allows the owner (artifact ownership)", () => {
  const file = artifactPath(RUN, "03-venues.md");
  const payload = (agentType: string): unknown => ({
    tool_name: "Write",
    agent_type: agentType,
    tool_input: { file_path: file, content: "x" },
  });
  const foreign = runHook("state-integrity-guard", payload("catering-planner"));
  assert.equal(foreign.decision, "deny");
  assert.match(foreign.stdout, /owned by venue-scout/);
  assert.equal(runHook("state-integrity-guard", payload("venue-scout")).stdout, "");
});
