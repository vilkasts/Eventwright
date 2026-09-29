import type { ApprovalFile } from "@/types/approval";

// Одобрение действует только для тех байтов плана, которые видел человек.
export const isApprovalCurrent = (approval: ApprovalFile | null, planSha256: string | null): boolean =>
  approval !== null &&
  planSha256 !== null &&
  approval.current.decision === "approved" &&
  approval.current.planSha256 === planSha256;
