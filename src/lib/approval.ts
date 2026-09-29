import { APPROVAL_RECORDED_BY, HASH_PREVIEW_LENGTH, PLAN_AGENT } from "@/config/workflow";
import { gateIdsForStage } from "@/lib/dag-queries";
import { nextAction } from "@/lib/next-action";
import { appendLog } from "@/lib/state";
import type { ApprovalFile, ApprovalRecord, DecisionRequest } from "@/types/approval";
import type { WorkflowState } from "@/types/workflow";

const reopenPlanForRevision = (state: WorkflowState, feedback: string): void => {
  const plan = state.agents[PLAN_AGENT];
  plan.status = "stale";
  plan.feedback = feedback;
  for (const id of gateIdsForStage("final")) state.gates[id].status = "pending";
  state.validation.final = null;
};

// Решение человека: проверяет, что run ждёт одобрения именно этого плана, и возвращает новый approval.json.
export const applyDecision = (
  state: WorkflowState,
  approval: ApprovalFile | null,
  request: DecisionRequest,
  planSha256OnDisk: string | null,
  now: string,
): ApprovalFile => {
  const action = nextAction(state, approval);
  if (action.action !== "await-approval") {
    throw new Error(`Run ${state.runId} is not awaiting approval (next step: ${action.action}).`);
  }
  if (planSha256OnDisk === null || planSha256OnDisk !== state.agents[PLAN_AGENT].sha256) {
    throw new Error(`The plan of ${state.runId} changed after its last validation — run /resume-event ${state.runId}.`);
  }

  const history = approval?.history ?? [];
  const feedback = request.decision === "rejected" ? request.feedback : null;
  const current: ApprovalRecord = {
    decision: request.decision,
    planSha256: planSha256OnDisk,
    round: history.length + 1,
    feedback,
    recordedAt: now,
    recordedBy: APPROVAL_RECORDED_BY,
  };
  if (feedback !== null) reopenPlanForRevision(state, feedback);
  const details = { round: current.round, planSha256: planSha256OnDisk.slice(0, HASH_PREVIEW_LENGTH) };
  appendLog(state, `approval-${request.decision}`, details, now);
  return { runId: state.runId, current, history: [...history, current] };
};
