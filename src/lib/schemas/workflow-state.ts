import { SCHEMA_VERSION } from "@/config/workflow";
import { isAgentName } from "@/lib/dag-queries";
import { isOneOf, isRecord } from "@/lib/narrow";
import { AGENT_NAMES, AGENT_STATUSES, GATE_IDS, GATE_STATUSES } from "@/types/workflow";
import type { WorkflowState } from "@/types/workflow";

const FAILURE_KINDS = ["gate", "agent"] as const;

const isCount = (value: unknown): boolean => typeof value === "number" && Number.isInteger(value) && value >= 0;
const isString = (value: unknown): boolean => typeof value === "string";
const isStringOrNull = (value: unknown): boolean => value === null || typeof value === "string";
const isListOf = (value: unknown, isItem: (item: unknown) => boolean): boolean =>
  Array.isArray(value) && value.every(isItem);

const hasEntries = (value: unknown, keys: readonly string[], isEntry: (entry: unknown) => boolean): boolean =>
  isRecord(value) && keys.every((key) => isEntry(value[key]));

// Every field the workflow reads or increments: a missing counter would turn into NaN and stop the run (F06).
const isAgentState = (value: unknown): boolean =>
  isRecord(value) &&
  isOneOf(AGENT_STATUSES, value.status) &&
  isCount(value.attempts) &&
  isCount(value.startsWithoutArtifact) &&
  isCount(value.structuralFailures) &&
  typeof value.structureOk === "boolean" &&
  isStringOrNull(value.sha256) &&
  isStringOrNull(value.updatedAt) &&
  isStringOrNull(value.lastError) &&
  isStringOrNull(value.feedback) &&
  isRecord(value.outputs) &&
  Object.values(value.outputs).every(isString);

const isGateState = (value: unknown): boolean =>
  isRecord(value) &&
  isOneOf(GATE_STATUSES, value.status) &&
  isCount(value.attempts) &&
  isListOf(value.findings, isString);

const isValidationRecord = (value: unknown): boolean =>
  value === null ||
  (isRecord(value) &&
    isStringOrNull(value.sha256) &&
    typeof value.recorded === "boolean" &&
    isString(value.at) &&
    (value.writer === undefined || isString(value.writer)));

const isExecutionPlan = (value: unknown): boolean =>
  value === null ||
  (isRecord(value) &&
    isListOf(value.services, isString) &&
    isListOf(value.selected, isAgentName) &&
    isListOf(value.skipped, isAgentName) &&
    isString(value.at));

const isFailure = (value: unknown): boolean =>
  value === null ||
  (isRecord(value) &&
    isOneOf(FAILURE_KINDS, value.kind) &&
    isListOf(value.findings, isString) &&
    isCount(value.attempts) &&
    isString(value.at));

// State from disk is validated before use: a broken or foreign file gives a clear error instead of a crash later.
export const isWorkflowState = (value: unknown): value is WorkflowState =>
  isRecord(value) &&
  value.schemaVersion === SCHEMA_VERSION &&
  isString(value.runId) &&
  isString(value.createdAt) &&
  isString(value.updatedAt) &&
  isString(value.phase) &&
  typeof value.requirementsConfirmed === "boolean" &&
  isExecutionPlan(value.plan) &&
  isFailure(value.failure) &&
  hasEntries(value.agents, AGENT_NAMES, isAgentState) &&
  hasEntries(value.gates, GATE_IDS, isGateState) &&
  hasEntries(value.validation, ["domain", "final"], isValidationRecord) &&
  Array.isArray(value.log);
