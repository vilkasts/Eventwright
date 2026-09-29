import { SCHEMA_VERSION } from "@/config/workflow";
import { isOneOf, isRecord } from "@/lib/narrow";
import { AGENT_NAMES, AGENT_STATUSES, GATE_IDS, GATE_STATUSES } from "@/types/workflow";
import type { WorkflowState } from "@/types/workflow";

const hasEntries = (value: unknown, keys: readonly string[], isEntry: (entry: unknown) => boolean): boolean =>
  isRecord(value) && keys.every((key) => isEntry(value[key]));

const isAgentState = (value: unknown): boolean =>
  isRecord(value) &&
  isOneOf(AGENT_STATUSES, value.status) &&
  typeof value.attempts === "number" &&
  typeof value.structureOk === "boolean";

const isGateState = (value: unknown): boolean =>
  isRecord(value) && isOneOf(GATE_STATUSES, value.status) && typeof value.attempts === "number";

// Состояние с диска проверяется до использования: битый или чужой файл даёт понятную ошибку, а не падение позже.
export const isWorkflowState = (value: unknown): value is WorkflowState =>
  isRecord(value) &&
  value.schemaVersion === SCHEMA_VERSION &&
  typeof value.runId === "string" &&
  typeof value.requirementsConfirmed === "boolean" &&
  hasEntries(value.agents, AGENT_NAMES, isAgentState) &&
  hasEntries(value.gates, GATE_IDS, isGateState) &&
  isRecord(value.validation) &&
  Array.isArray(value.log);
