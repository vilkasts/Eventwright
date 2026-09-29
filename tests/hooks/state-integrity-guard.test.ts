import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { statePath } from "@/io/paths";
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
