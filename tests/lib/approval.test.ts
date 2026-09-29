import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

import { applyDecision } from "@/lib/approval";
import { isApprovalCurrent } from "@/lib/approval-status";
import { sha256 } from "@/lib/hash";
import type { WorkflowState } from "@/types/workflow";
import { buildAwaitingApprovalState, PLAN_TEXT } from "@tests/support/approval-fixtures";
import { NOW } from "@tests/support/state-fixtures";

const PLAN_HASH = sha256(PLAN_TEXT);
let state: WorkflowState;

beforeEach(() => {
  state = buildAwaitingApprovalState("run-1");
});

describe("applyDecision", () => {
  test("an approval binds to the plan hash on disk", () => {
    const approval = applyDecision(state, null, { decision: "approved" }, PLAN_HASH, NOW);
    assert.equal(approval.current.planSha256, PLAN_HASH);
    assert.equal(isApprovalCurrent(approval, PLAN_HASH), true);
    assert.equal(isApprovalCurrent(approval, sha256("# Event plan v2\n")), false);
  });

  test("a rejection reopens the plan with feedback and keeps history", () => {
    const approval = applyDecision(
      state,
      null,
      { decision: "rejected", feedback: "add a photo booth" },
      PLAN_HASH,
      NOW,
    );
    assert.equal(state.agents["event-plan-builder"].status, "stale");
    assert.equal(state.agents["event-plan-builder"].feedback, "add a photo booth");
    assert.equal(state.gates["G10-plan-covers-requirements"].status, "pending");
    assert.equal(approval.history.length, 1);
  });

  test("refuses a decision when the run is not awaiting approval", () => {
    const rejected = applyDecision(state, null, { decision: "rejected", feedback: "x" }, PLAN_HASH, NOW);
    assert.throws(
      () => applyDecision(state, rejected, { decision: "approved" }, PLAN_HASH, NOW),
      /not awaiting approval/,
    );
  });

  test("refuses a decision when the plan file changed after validation", () => {
    assert.throws(
      () => applyDecision(state, null, { decision: "approved" }, sha256("# tampered\n"), NOW),
      /changed after its last validation/,
    );
  });
});
