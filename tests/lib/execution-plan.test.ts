import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

import { applyExecutionPlan, parseServices } from "@/lib/execution-plan";
import { createInitialState, invalidateAgents, recordArtifactWrite } from "@/lib/state";
import type { WorkflowState } from "@/types/workflow";
import { ALL_SERVICES } from "@tests/support/plan-fixtures";
import { markDone, NOW } from "@tests/support/state-fixtures";

describe("parseServices", () => {
  test("reads a comma-separated service list", () => {
    assert.deepEqual(parseServices("- Services: venue, Catering , entertainment\n"), [
      "venue",
      "catering",
      "entertainment",
    ]);
  });
  test("returns null without the line", () => {
    assert.equal(parseServices("- Budget: 1000 EUR"), null);
  });
});

describe("applyExecutionPlan", () => {
  let state: WorkflowState;
  beforeEach(() => {
    state = createInitialState("run-1", NOW);
  });

  test("skips planners of services that were not requested", () => {
    const plan = applyExecutionPlan(state, ["venue", "entertainment", "logistics"], NOW);
    assert.deepEqual(plan.skipped, ["catering-planner"]);
    assert.ok(!plan.selected.includes("catering-planner"));
    assert.equal(state.agents["catering-planner"].status, "skipped");
    assert.equal(state.gates["G5-dietary-coverage"].status, "n/a");
    assert.equal(state.gates["G2-sources-cited"].status, "pending");
  });
  test("keeps every agent when all services are requested", () => {
    assert.deepEqual(applyExecutionPlan(state, ALL_SERVICES, NOW).skipped, []);
  });
  test("rejects unknown services and leaves the state untouched", () => {
    assert.throws(() => applyExecutionPlan(state, ["venue", "fireworks"], NOW), /fireworks/);
    assert.equal(state.plan, null);
  });
  test("new requirements restore skipped agents and not-applicable gates", () => {
    markDone(state, ["requirements-formalizer"]);
    applyExecutionPlan(state, ["venue"], NOW);
    recordArtifactWrite(
      state,
      { runId: "run-1", area: "artifacts", fileName: "01-requirements.md" },
      "v2",
      "test",
      NOW,
    );
    assert.equal(state.plan, null);
    assert.equal(state.agents["catering-planner"].status, "pending");
    assert.equal(state.gates["G5-dietary-coverage"].status, "pending");
  });
  test("a skipped agent cannot be invalidated", () => {
    applyExecutionPlan(state, ["venue"], NOW);
    assert.throws(() => {
      invalidateAgents(state, ["catering-planner"], "x", NOW);
    }, /not in the execution plan/);
  });
});
