// Checks that a workflow-state.json read from disk really has the shape of WorkflowState.
// Every field is checked, so later code can trust the types instead of crashing on a broken file.
import { SCHEMA_VERSION, VENUE_SERVICE } from "@/config/workflow";
import { isAgentName } from "@/lib/dag-queries";
import { isOneOf, isRecord } from "@/lib/narrow";
import { isCount, isListOf, isString, isStringOrNull } from "@/lib/schemas/primitives";
import { AGENT_NAMES, AGENT_STATUSES, GATE_IDS, GATE_STATUSES, SERVICES } from "@/types/workflow";
import type { ActionName, RequestedService, WorkflowState } from "@/types/workflow";

const REQUESTED_SERVICES: readonly RequestedService[] = [VENUE_SERVICE, ...SERVICES];
// A record over every phase: adding an action to the Action type without listing it here is a compile error.
const PHASES: Readonly<Record<ActionName | "init", true>> = {
  init: true,
  failed: true,
  check: true,
  run: true,
  clarify: true,
  plan: true,
  validate: true,
  "record-gates": true,
  "await-approval": true,
  done: true,
};

// True for a known phase name.
const isPhase = (value: unknown): boolean => typeof value === "string" && Object.hasOwn(PHASES, value);

// An object that has every one of the given keys, each passing the check (e.g. every agent has a valid state).
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

// The shape of GateState.
const isGateState = (value: unknown): boolean =>
  isRecord(value) &&
  isOneOf(GATE_STATUSES, value.status) &&
  isCount(value.attempts) &&
  isListOf(value.findings, isString);

// A validator report record, or null when no report was written since the gates were reset.
const isValidationRecord = (value: unknown): boolean =>
  value === null ||
  (isRecord(value) &&
    isStringOrNull(value.sha256) &&
    typeof value.recorded === "boolean" &&
    isString(value.at) &&
    (value.writer === undefined || isString(value.writer)));

// The execution plan, or null before `wf plan` ran.
const isExecutionPlan = (value: unknown): boolean =>
  value === null ||
  (isRecord(value) &&
    isListOf(value.services, (service) => isOneOf(REQUESTED_SERVICES, service)) &&
    isListOf(value.selected, isAgentName) &&
    isListOf(value.skipped, isAgentName) &&
    isString(value.at));

// A failure names the blocked gate or the agent that kept failing.
const isFailureSubject = (value: Record<string, unknown>): boolean =>
  value.kind === "gate" ? isOneOf(GATE_IDS, value.gate) : value.kind === "agent" && isAgentName(value.agent);

// The reason the run stopped, or null while it is still going.
const isFailure = (value: unknown): boolean =>
  value === null ||
  (isRecord(value) &&
    isFailureSubject(value) &&
    isListOf(value.findings, isString) &&
    isCount(value.attempts) &&
    isString(value.at));

// One history entry: when, what happened, and details.
const isLogEntry = (value: unknown): boolean =>
  isRecord(value) && isString(value.at) && isString(value.event) && isRecord(value.details);

// State from disk is validated before use: a broken or foreign file gives a clear error instead of a crash later.
export const isWorkflowState = (value: unknown): value is WorkflowState =>
  isRecord(value) &&
  value.schemaVersion === SCHEMA_VERSION &&
  isString(value.runId) &&
  isString(value.createdAt) &&
  isString(value.updatedAt) &&
  isPhase(value.phase) &&
  typeof value.requirementsConfirmed === "boolean" &&
  isExecutionPlan(value.plan) &&
  isFailure(value.failure) &&
  hasEntries(value.agents, AGENT_NAMES, isAgentState) &&
  hasEntries(value.gates, GATE_IDS, isGateState) &&
  hasEntries(value.validation, ["domain", "final"], isValidationRecord) &&
  isListOf(value.log, isLogEntry);
