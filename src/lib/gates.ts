import { DAG } from "@/config/dag";
import { MAX_RETRIES } from "@/config/workflow";
import { downstreamOf, gateIdsForStage, isAgentName } from "@/lib/dag-queries";
import { appendLog, markStale } from "@/lib/state";
import type { AgentName, GatedStage, GateId, GateSummary, WorkflowState } from "@/types/workflow";

type GateRow = {
  status: string;
  owners: string[];
  finding: string;
};

const GATE_ROW_ID = /^G\d+-/;
const MIN_GATE_ROW_CELLS = 6;
const VERDICTS: readonly string[] = ["PASS", "FAIL"];

// A validator report row: | G5-dietary-coverage | FAIL | catering-planner | finding |
export const parseGateTable = (reportText: string): Map<string, GateRow> => {
  const rows = new Map<string, GateRow>();
  for (const line of reportText.split(/\r?\n/)) {
    const cells = line.split("|").map((cell) => cell.trim());
    const [, id = "", status = "", owners = "", finding = ""] = cells;
    if (cells.length < MIN_GATE_ROW_CELLS || !GATE_ROW_ID.test(id)) continue;
    const ownerList = owners
      .split(",")
      .map((owner) => owner.trim())
      .filter((owner) => owner.length > 0);
    rows.set(id, { status: status.toUpperCase(), owners: ownerList, finding });
  }
  return rows;
};

const activeOwners = (state: WorkflowState, id: GateId): AgentName[] =>
  DAG.gates[id].owners.filter((owner) => state.agents[owner].status !== "skipped");

// Reported owners intersected with the allowed ones; if the validator named others, all allowed owners.
const ownersToRetry = (state: WorkflowState, id: GateId, reported: readonly string[]): AgentName[] => {
  const allowed = activeOwners(state, id);
  const named = reported.filter(isAgentName).filter((owner) => allowed.includes(owner));
  return named.length > 0 ? named : allowed;
};

const requireRows = (state: WorkflowState, stage: GatedStage, rows: Map<string, GateRow>): GateId[] => {
  const expected = gateIdsForStage(stage).filter((id) => state.gates[id].status !== "n/a");
  const missing = expected.filter((id) => !VERDICTS.includes(rows.get(id)?.status ?? ""));
  if (missing.length > 0) throw new Error(`Validator report lacks valid rows for gates: ${missing.join(", ")}`);
  return expected;
};

const retryAffectedAgents = (state: WorkflowState, findingsByOwner: Map<AgentName, string[]>): void => {
  const owners = [...findingsByOwner.keys()];
  const affected = [...new Set([...owners, ...owners.flatMap(downstreamOf)])];
  markStale(
    state,
    affected,
    (name) => findingsByOwner.get(name)?.join("; ") ?? "an upstream artifact is being fixed — regenerate",
  );
};

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
  state.validation[stage] = { sha256: state.validation[stage]?.sha256 ?? null, recorded: true, at: now };
  const failedIds = summary.failed.map((failure) => failure.id);
  appendLog(
    state,
    "gates-recorded",
    { stage, passed: summary.passed.length, failed: failedIds, blocked: summary.blocked },
    now,
  );
  return summary;
};
