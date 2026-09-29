import type { ApprovalCommand } from "@/types/approval";

const APPROVE = /^\/approve-event\s+(\S+)\s*$/;
const REJECT = /^\/reject-event\s+(\S+)(?:\s+([\s\S]+))?$/;

// Разбирает сырой текст, набранный человеком; всё остальное — не команда одобрения.
export const parseApprovalCommand = (prompt: string): ApprovalCommand | null => {
  const text = prompt.trim();
  const [, approvedRun] = APPROVE.exec(text) ?? [];
  if (approvedRun !== undefined) return { runId: approvedRun, decision: "approved" };
  const [, rejectedRun, feedback] = REJECT.exec(text) ?? [];
  if (rejectedRun === undefined) return null;
  const trimmed = feedback?.trim() ?? "";
  return { runId: rejectedRun, decision: "rejected", feedback: trimmed.length > 0 ? trimmed : null };
};
