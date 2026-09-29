import type { ApprovalCommand } from "@/types/approval";

const APPROVE = /^\/approve-event\s+(\S+)\s*$/;
const REJECT = /^\/reject-event\s+(\S+)(?:\s+([\s\S]+))?$/;
const DECISION_COMMAND = /^\/(?:approve|reject)-event(?:\s|$)/;

// The human typed an approval command, even if it does not parse: it must not pass silently (F13).
export const isDecisionAttempt = (prompt: string): boolean => DECISION_COMMAND.test(prompt.trim());

// Parses the raw text typed by the human; anything else is not an approval command.
export const parseApprovalCommand = (prompt: string): ApprovalCommand | null => {
  const text = prompt.trim();
  const [, approvedRun] = APPROVE.exec(text) ?? [];
  if (approvedRun !== undefined) return { runId: approvedRun, decision: "approved" };
  const [, rejectedRun, feedback] = REJECT.exec(text) ?? [];
  if (rejectedRun === undefined) return null;
  const trimmed = feedback?.trim() ?? "";
  return { runId: rejectedRun, decision: "rejected", feedback: trimmed.length > 0 ? trimmed : null };
};
