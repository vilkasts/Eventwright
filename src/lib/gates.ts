// Quality gates: reading the validator's report and applying it to the run.
// A failing gate sends only its owners (and the agents built on their work) back for a retry;
// too many failures in a row block the gate and stop the run.
import { DAG } from "@/config/dag";
import { MAX_RETRIES, VALIDATOR_NAME } from "@/config/workflow";
import { downstreamOf, gateIdsForStage, isAgentName } from "@/lib/dag-queries";
import { sectionLines } from "@/lib/sections";
import { appendLog, markStale } from "@/lib/state";
import type { AgentName, GatedStage, GateId, GateSummary, WorkflowState } from "@/types/workflow";

// One row of the report's results table, before its values are checked.
type GateRow = {
  status: string;
  owners: string[];
  finding: string;
};

// Gate ids start like "G7-".
const GATE_ROW_ID = /^G\d+-/;
// "| id | status | owners | finding |" splits into 6 cells (including the empty ones at both ends).
const MIN_GATE_ROW_CELLS = 6;
const VERDICTS: readonly string[] = ["PASS", "FAIL"];
const RESULTS_SECTION = "Gate results";

// Only the results table counts: a row quoted in '## Details' must not override the verdict (F15).
const resultLines = (reportText: string): string[] => {
  const lines = sectionLines(reportText.split(/\r?\n/), RESULTS_SECTION);
  if (lines === null) throw new Error(`Validator report lacks the '## ${RESULTS_SECTION}' section.`);
  return lines;
};

// A validator report row: | G5-dietary-coverage | FAIL | catering-planner | finding |
// Returns the rows by gate id; throws if a gate appears twice, because then the verdict would be ambiguous.
export const parseGateTable = (reportText: string): Map<string, GateRow> => {
  const rows = new Map<string, GateRow>();
  const duplicates = new Set<string>();
  for (const line of resultLines(reportText)) {
    const cells = line.split("|").map((cell) => cell.trim());
    const [, id = "", status = "", owners = "", finding = ""] = cells;
    if (cells.length < MIN_GATE_ROW_CELLS || !GATE_ROW_ID.test(id)) continue;
    if (rows.has(id)) duplicates.add(id);
    const ownerList = owners
      .split(",")
      .map((owner) => owner.trim())
      .filter((owner) => owner.length > 0);
    rows.set(id, { status: status.toUpperCase(), owners: ownerList, finding });
  }
  if (duplicates.size > 0) {
    throw new Error(`Validator report has more than one row for gates: ${[...duplicates].join(", ")}.`);
  }
  return rows;
};

// The gate's owners that are part of this run (skipped planners cannot fix anything).
const activeOwners = (state: WorkflowState, id: GateId): AgentName[] =>
  DAG.gates[id].owners.filter((owner) => state.agents[owner].status !== "skipped");

// Reported owners intersected with the allowed ones; if the validator named others, all allowed owners.
const ownersToRetry = (state: WorkflowState, id: GateId, reported: readonly string[]): AgentName[] => {
  const allowed = activeOwners(state, id);
  const named = reported.filter(isAgentName).filter((owner) => allowed.includes(owner));
  return named.length > 0 ? named : allowed;
};

// Every applicable gate of the stage must have a PASS or FAIL row; otherwise the report is rejected
// before anything changes (so a broken report never counts as an attempt).
const requireRows = (state: WorkflowState, stage: GatedStage, rows: Map<string, GateRow>): GateId[] => {
  const expected = gateIdsForStage(stage).filter((id) => state.gates[id].status !== "n/a");
  const missing = expected.filter((id) => !VERDICTS.includes(rows.get(id)?.status ?? ""));
  if (missing.length > 0) throw new Error(`Validator report lacks valid rows for gates: ${missing.join(", ")}`);
  return expected;
};

// Marks the failing owners and everything downstream of them stale; each owner gets its findings as the retry reason.
const retryAffectedAgents = (state: WorkflowState, findingsByOwner: Map<AgentName, string[]>): void => {
  const owners = [...findingsByOwner.keys()];
  const affected = [...new Set([...owners, ...owners.flatMap(downstreamOf)])];
  markStale(
    state,
    affected,
    (name) => findingsByOwner.get(name)?.join("; ") ?? "an upstream artifact is being fixed — regenerate",
  );
};

// A report counts only if the validator wrote it after the gates were reset (post-write-state stored its
// hash) and it was not recorded yet: an old all-PASS report must never pass an unvalidated plan.
export const staleReportIssue = (
  state: WorkflowState,
  stage: GatedStage,
  reportSha256: string | null,
): string | null => {
  const report = state.validation[stage];
  if (report === null) {
    return `The ${stage} validator report was not written by the validator since the gates were reset — relaunch the validator.`;
  }
  // Only the validator subagent may produce gate verdicts; a report written by the coordinator is not one.
  if (report.writer !== VALIDATOR_NAME) {
    return `The ${stage} validator report was written by ${report.writer ?? "an unknown writer"}, not by the ${VALIDATOR_NAME} subagent — relaunch the validator.`;
  }
  if (report.recorded) return `The ${stage} validator report was already recorded — relaunch the validator.`;
  if (report.sha256 !== reportSha256) {
    return `The ${stage} validator report changed after the validator wrote it — relaunch the validator.`;
  }
  return null;
};

// Applies a validator report to the gates of a stage (called by `wf record-gates`):
// PASS resets the gate's failure count; FAIL counts a failure and schedules the owners for a retry;
// a failure beyond MAX_RETRIES blocks the gate and records why the run stopped.
export const recordGates = (state: WorkflowState, stage: GatedStage, reportText: string, now: string): GateSummary => {
  const rows = parseGateTable(reportText);
  const expected = requireRows(state, stage, rows);
  const summary: GateSummary = { passed: [], failed: [], blocked: [] };
  const findingsByOwner = new Map<AgentName, string[]>();

  for (const id of expected) {
    const row = rows.get(id);
    const gate = state.gates[id];
    if (row === undefined) continue;
    if (row.status === "PASS") {
      state.gates[id] = { status: "pass", attempts: 0, findings: [] };
      summary.passed.push(id);
      continue;
    }
    gate.attempts += 1;
    gate.findings = [row.finding];
    if (gate.attempts > MAX_RETRIES) {
      gate.status = "blocked";
      summary.blocked.push(id);
      state.failure ??= { kind: "gate", gate: id, findings: gate.findings, attempts: gate.attempts, at: now };
      continue;
    }
    gate.status = "fail";
    const owners = ownersToRetry(state, id, row.owners);
    summary.failed.push({ id, owners });
    for (const owner of owners) {
      findingsByOwner.set(owner, [...(findingsByOwner.get(owner) ?? []), `${id}: ${row.finding}`]);
    }
  }

  if (state.failure === null) retryAffectedAgents(state, findingsByOwner);
  const report = state.validation[stage];
  state.validation[stage] =
    report === null ? { sha256: null, recorded: true, at: now } : { ...report, recorded: true, at: now };
  const failedIds = summary.failed.map((failure) => failure.id);
  appendLog(
    state,
    "gates-recorded",
    { stage, passed: summary.passed.length, failed: failedIds, blocked: summary.blocked },
    now,
  );
  return summary;
};
