// Types of the human approval step: the decision a person types and the approval.json file that records it.

export type Decision = "approved" | "rejected";

// A decision to apply; a rejection always carries the human's feedback.
export type DecisionRequest = { decision: "approved" } | { decision: "rejected"; feedback: string };

// One approval round as stored in approval.json.
export type ApprovalRecord = {
  decision: Decision;
  // sha256 of the plan (08-event-plan.md) the human saw; the approval is valid only for exactly these bytes.
  planSha256: string;
  // 1 for the first decision, 2 after one rejection, and so on.
  round: number;
  feedback: string | null;
  recordedAt: string;
  // Always the record-approval hook: the model cannot write this file.
  recordedBy: string;
};

// runs/<runId>/approval.json: the latest decision plus every earlier round.
export type ApprovalFile = {
  runId: string;
  current: ApprovalRecord;
  history: ApprovalRecord[];
};

// A parsed "/approve-event <runId>" or "/reject-event <runId> <feedback>" prompt. Feedback may still be missing here.
export type ApprovalCommand =
  { runId: string; decision: "approved" } | { runId: string; decision: "rejected"; feedback: string | null };
