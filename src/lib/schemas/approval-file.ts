import { isOneOf, isRecord } from "@/lib/narrow";
import type { ApprovalFile, ApprovalRecord, Decision } from "@/types/approval";

const DECISIONS: readonly Decision[] = ["approved", "rejected"];

const isApprovalRecord = (value: unknown): value is ApprovalRecord =>
  isRecord(value) &&
  isOneOf(DECISIONS, value.decision) &&
  typeof value.planSha256 === "string" &&
  typeof value.round === "number";

export const isApprovalFile = (value: unknown): value is ApprovalFile =>
  isRecord(value) &&
  typeof value.runId === "string" &&
  isApprovalRecord(value.current) &&
  Array.isArray(value.history) &&
  value.history.every(isApprovalRecord);
