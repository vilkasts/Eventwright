import type { ApprovalFile } from "@/types/approval";

// An approval is valid only for the exact plan bytes the human saw.
export const isApprovalCurrent = (approval: ApprovalFile | null, planSha256: string | null): boolean =>
  approval !== null &&
  planSha256 !== null &&
  approval.current.decision === "approved" &&
  approval.current.planSha256 === planSha256;
