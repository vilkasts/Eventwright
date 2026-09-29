// Whether a run's plan is approved right now.
import type { ApprovalFile } from "@/types/approval";

// An approval is valid only for the exact plan bytes the human saw.
// Editing the plan after approval changes its hash, so the old approval no longer counts.
export const isApprovalCurrent = (approval: ApprovalFile | null, planSha256: string | null): boolean =>
  approval !== null &&
  planSha256 !== null &&
  approval.current.decision === "approved" &&
  approval.current.planSha256 === planSha256;
