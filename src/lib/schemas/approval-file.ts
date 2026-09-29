// Checks that an approval.json read from disk has the shape of ApprovalFile.
import { isOneOf, isRecord } from "@/lib/narrow";
import { isCount, isListOf, isString, isStringOrNull } from "@/lib/schemas/primitives";
import type { ApprovalFile, ApprovalRecord, Decision } from "@/types/approval";

// The two decisions a human can type.
const DECISIONS: readonly Decision[] = ["approved", "rejected"];

// Every field of the record is checked, so the type guard claims no more than it verified (M6).
const isApprovalRecord = (value: unknown): value is ApprovalRecord =>
  isRecord(value) &&
  isOneOf(DECISIONS, value.decision) &&
  isString(value.planSha256) &&
  isCount(value.round) &&
  isStringOrNull(value.feedback) &&
  isString(value.recordedAt) &&
  isString(value.recordedBy);

// The whole file: the current decision and the history of every round.
export const isApprovalFile = (value: unknown): value is ApprovalFile =>
  isRecord(value) &&
  isString(value.runId) &&
  isApprovalRecord(value.current) &&
  isListOf(value.history, isApprovalRecord);
