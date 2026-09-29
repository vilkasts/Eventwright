import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { recordAgentStarts, startedWithoutWriteIssues } from "@/lib/agent-runs";
import { createInitialState, recordArtifactWrite } from "@/lib/state";
import type { WorkflowState } from "@/types/workflow";
import { NOW } from "@tests/support/state-fixtures";

let state: WorkflowState;
beforeEach(() => {
  state = createInitialState("run-1", NOW);
});

test("an agent that was started but has not rewritten its artifact is flagged", () => {
  recordAgentStarts(state, ["weather-analyst"], NOW);
  assert.match(startedWithoutWriteIssues(state, "weather-analyst").join(), /02-weather-outlook\.md was not rewritten/);
});

test("an agent that wrote its artifact after the start is accepted", () => {
  recordAgentStarts(state, ["weather-analyst"], NOW);
  const location = { runId: "run-1", area: "artifacts", fileName: "02-weather-outlook.md" } as const;
  recordArtifactWrite(state, location, "h1", "test", NOW);
  assert.deepEqual(startedWithoutWriteIssues(state, "weather-analyst"), []);
});

test("an agent that was never started is not flagged", () => {
  assert.deepEqual(startedWithoutWriteIssues(state, "weather-analyst"), []);
});
