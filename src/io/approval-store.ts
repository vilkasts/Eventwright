// Reading and recording human approval decisions (runs/<runId>/approval.json).
import { PLAN_AGENT } from "@/config/workflow";
import { fileExists, readJson, sha256OfFile, writeJsonAtomic } from "@/io/files";
import { approvalPath, artifactPath } from "@/io/paths";
import { withRunLock } from "@/io/run-lock";
import { loadState, saveState } from "@/io/state-store";
import { applyDecision } from "@/lib/approval";
import { isApprovalCurrent } from "@/lib/approval-status";
import { requireArtifactOf } from "@/lib/dag-queries";
import { isApprovalFile } from "@/lib/schemas/approval-file";
import type { ApprovalFile, ApprovalRecord, DecisionRequest } from "@/types/approval";

// The plan file whose exact bytes the human approves: runs/<runId>/artifacts/08-event-plan.md.
const planFilePath = (runId: string): string => artifactPath(runId, requireArtifactOf(PLAN_AGENT));

// The run's approval file, or null if no decision was made yet; throws if the file is broken.
export const readApproval = (runId: string): ApprovalFile | null => {
  if (!fileExists(approvalPath(runId))) return null;
  const raw = readJson(approvalPath(runId));
  if (!isApprovalFile(raw)) throw new Error(`${approvalPath(runId)} is not a valid approval file.`);
  return raw;
};

// Whether what is on disk now is approved, not what the human saw earlier.
export const isApproved = (runId: string): boolean =>
  isApprovalCurrent(readApproval(runId), sha256OfFile(planFilePath(runId)));

// Records a human decision (called only by the record-approval hook).
// approval.json and the state change together, under the same run lock as every other state update.
export const recordDecision = (runId: string, request: DecisionRequest, now: string): ApprovalRecord =>
  withRunLock(runId, () => {
    const state = loadState(runId);
    const approval = applyDecision(state, readApproval(runId), request, sha256OfFile(planFilePath(runId)), now);
    writeJsonAtomic(approvalPath(runId), approval);
    saveState(state, now);
    return approval.current;
  });
