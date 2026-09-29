// Test helpers for the approval step: a sample plan, an approval file and a run that waits for the human.
import { ARTIFACTS_AREA, PLAN_AGENT } from "@/config/workflow";
import { requireArtifactOf } from "@/lib/dag-queries";
import { recordGates } from "@/lib/gates";
import { sha256 } from "@/lib/hash";
import { createInitialState, recordArtifactWrite } from "@/lib/state";
import type { ApprovalFile, ApprovalRecord } from "@/types/approval";
import type { WorkflowState } from "@/types/workflow";
import { gateReport } from "@tests/support/gate-fixtures";
import { confirmWithPlan } from "@tests/support/plan-fixtures";
import { DOMAIN_AGENTS, markDone, NOW } from "@tests/support/state-fixtures";

// The content used as 08-event-plan.md in tests.
export const PLAN_TEXT = "# Event plan\n";

// An approval.json that approves the plan with the given hash.
export const approvedFile = (runId: string, planSha256: string): ApprovalFile => {
  const current: ApprovalRecord = {
    decision: "approved",
    planSha256,
    round: 1,
    feedback: null,
    recordedAt: NOW,
    recordedBy: "test",
  };
  return { runId, current, history: [current] };
};

// A run whose plan passed all gates and awaits the human; plan hash = sha256(planText).
export const buildAwaitingApprovalState = (runId: string, planText: string = PLAN_TEXT): WorkflowState => {
  const state = createInitialState(runId, NOW);
  markDone(state, DOMAIN_AGENTS);
  confirmWithPlan(state);
  recordGates(state, "domain", gateReport("domain"), NOW);
  const location = { runId, area: ARTIFACTS_AREA, fileName: requireArtifactOf(PLAN_AGENT) };
  recordArtifactWrite(state, location, sha256(planText), "test", NOW);
  state.agents[PLAN_AGENT].structureOk = true;
  recordGates(state, "final", gateReport("final"), NOW);
  return state;
};
