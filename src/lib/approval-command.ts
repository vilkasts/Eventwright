// Parsing the approval commands a human types: "/approve-event <runId>" and "/reject-event <runId> <feedback>".
import type { ApprovalCommand } from "@/types/approval";

// Exactly "/approve-event <runId>", nothing after it.
const APPROVE = /^\/approve-event\s+(\S+)\s*$/;
// "/reject-event <runId>" optionally followed by feedback (which may span several lines).
const REJECT = /^\/reject-event\s+(\S+)(?:\s+([\s\S]+))?$/;
// Anything that starts like one of the two commands.
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
  // A rejection without feedback is returned with null; the hook then asks the human to add it.
  return { runId: rejectedRun, decision: "rejected", feedback: trimmed.length > 0 ? trimmed : null };
};
