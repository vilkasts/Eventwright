import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { beforeEach, test } from "node:test";

import { isApproved, readApproval, recordDecision } from "@/io/approval-store";
import { artifactPath } from "@/io/paths";
import { createRun, loadState } from "@/io/state-store";
import { buildAwaitingApprovalState, PLAN_TEXT } from "@tests/support/approval-fixtures";
import { NOW } from "@tests/support/state-fixtures";
import { useTempProject } from "@tests/support/temp-project";

const RUN = "run-approval";
const planFile = (): string => artifactPath(RUN, "08-event-plan.md");

beforeEach(() => {
  useTempProject();
  createRun(buildAwaitingApprovalState(RUN));
  writeFileSync(planFile(), PLAN_TEXT);
});

test("an approval is recorded and binds to the plan file", () => {
  recordDecision(RUN, { decision: "approved" }, NOW);
  assert.equal(readApproval(RUN)?.current.decision, "approved");
  assert.equal(isApproved(RUN), true);
});

test("editing the plan after approval revokes it", () => {
  recordDecision(RUN, { decision: "approved" }, NOW);
  writeFileSync(planFile(), "# Event plan v2\n");
  assert.equal(isApproved(RUN), false);
});

test("a rejection is persisted in both approval.json and the state", () => {
  recordDecision(RUN, { decision: "rejected", feedback: "add a photo booth" }, NOW);
  assert.equal(readApproval(RUN)?.history.length, 1);
  assert.equal(loadState(RUN).agents["event-plan-builder"].feedback, "add a photo booth");
  assert.equal(isApproved(RUN), false);
});
