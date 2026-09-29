export type Decision = "approved" | "rejected";

export type DecisionRequest = { decision: "approved" } | { decision: "rejected"; feedback: string };

export type ApprovalRecord = {
  decision: Decision;
  planSha256: string;
  round: number;
  feedback: string | null;
  recordedAt: string;
  recordedBy: string;
};

export type ApprovalFile = {
  runId: string;
  current: ApprovalRecord;
  history: ApprovalRecord[];
};

export type ApprovalCommand =
  { runId: string; decision: "approved" } | { runId: string; decision: "rejected"; feedback: string | null };
