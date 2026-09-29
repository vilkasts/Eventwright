// The run state and the rules for changing it. Pure logic: these functions change the state object they
// receive and never touch the disk (src/io saves the result). Functions named record*/invalidate*/mark*/confirm*
// mutate the state.
import { DAG } from "@/config/dag";
import {
  ARTIFACTS_AREA,
  HASH_PREVIEW_LENGTH,
  OUTPUT_AGENT,
  REQUIREMENTS_AGENT,
  SCHEMA_VERSION,
  STAGE_ORDER,
  validationFileName,
} from "@/config/workflow";
import { agentForFile, artifactOf, downstreamOf, outputFiles } from "@/lib/dag-queries";
import { recordOf } from "@/lib/narrow";
import { AGENT_NAMES, GATE_IDS } from "@/types/workflow";
import type { AgentName, AgentState, GatedStage, RunLocation, WorkflowState } from "@/types/workflow";

// A fresh agent that has not run yet.
const pendingAgent = (): AgentState => ({
  status: "pending",
  attempts: 0,
  startsWithoutArtifact: 0,
  structuralFailures: 0,
  structureOk: false,
  sha256: null,
  updatedAt: null,
  lastError: null,
  feedback: null,
  outputs: {},
});

// The state of a new run: every agent and gate pending, no execution plan, one "init" log entry.
export const createInitialState = (runId: string, now: string): WorkflowState => ({
  schemaVersion: SCHEMA_VERSION,
  runId,
  createdAt: now,
  updatedAt: now,
  phase: "init",
  requirementsConfirmed: false,
  plan: null,
  failure: null,
  agents: recordOf(AGENT_NAMES, pendingAgent),
  gates: recordOf(GATE_IDS, () => ({ status: "pending", attempts: 0, findings: [] })),
  validation: { domain: null, final: null },
  log: [{ at: now, event: "init", details: {} }],
});

// Adds one entry to the run's history. The log is what SCENARIO.md files and `wf status` are read from.
export const appendLog = (state: WorkflowState, event: string, details: Record<string, unknown>, now: string): void => {
  state.log.push({ at: now, event, details });
};

// Marks finished agents as stale (they must run again) and records why. Agents that are not done are left alone.
export const markStale = (
  state: WorkflowState,
  names: readonly AgentName[],
  reasonFor: (name: AgentName) => string,
): void => {
  for (const name of names) {
    const agent = state.agents[name];
    if (agent.status !== "done") continue;
    agent.status = "stale";
    agent.lastError = reasonFor(name);
  }
};

// When these agents' work changes, gates they own that already passed must be checked again,
// and the validator report of their stage no longer applies.
const resetPassedGates = (state: WorkflowState, names: readonly AgentName[]): void => {
  for (const id of GATE_IDS) {
    const gate = state.gates[id];
    if (gate.status === "pass" && DAG.gates[id].owners.some((owner) => names.includes(owner))) gate.status = "pending";
  }
  for (const name of names) {
    const stage = DAG.agents[name].stage;
    if (stage !== "output") state.validation[stage] = null;
  }
};

// New requirements may change the service list: the human confirms them again and the execution plan is rebuilt.
const resetExecutionPlan = (state: WorkflowState): void => {
  state.requirementsConfirmed = false;
  if (state.plan === null) return;
  for (const name of state.plan.skipped) state.agents[name].status = "pending";
  for (const id of GATE_IDS) {
    if (state.gates[id].status === "n/a") state.gates[id].status = "pending";
  }
  state.plan = null;
};

// The stage a file reports on if it is a validator report (validation-domain.md / validation-final.md), else null.
const validationStageOf = (location: RunLocation): GatedStage | null => {
  if (location.area !== ARTIFACTS_AREA) return null;
  return STAGE_ORDER.find((stage) => validationFileName(stage) === location.fileName) ?? null;
};

// Records one user-facing file written by html-builder; the agent is done once every output file exists.
const recordOutputWrite = (state: WorkflowState, fileName: string, hash: string, writer: string, now: string): void => {
  const agent = state.agents[OUTPUT_AGENT];
  agent.outputs[fileName] = hash;
  // Only a complete set of outputs ends the retry count; one file per round must still reach the limit.
  if (outputFiles().every((file) => agent.outputs[file] !== undefined)) {
    agent.startsWithoutArtifact = 0;
    agent.status = "done";
    agent.updatedAt = now;
  }
  appendLog(state, "output-written", { file: fileName, writer }, now);
};

// Called (through the post-write-state hook) after any file of a run is written. Depending on the file:
// - a validator report is stored as "written, not yet recorded";
// - an output file is added to html-builder's outputs;
// - an artifact marks its owner done, marks everything built on it stale and resets the gates they own.
// Rewriting an artifact with identical content changes nothing.
// Returns true if the state changed and must be saved.
export const recordArtifactWrite = (
  state: WorkflowState,
  location: RunLocation,
  hash: string,
  writer: string,
  now: string,
): boolean => {
  const validationStage = validationStageOf(location);
  if (validationStage !== null) {
    state.validation[validationStage] = { sha256: hash, recorded: false, at: now, writer };
    appendLog(state, "validation-written", { stage: validationStage, writer }, now);
    return true;
  }

  const agentName = agentForFile(location.area, location.fileName);
  if (agentName === null) return false;
  if (agentName === OUTPUT_AGENT) {
    recordOutputWrite(state, location.fileName, hash, writer, now);
    return true;
  }

  const agent = state.agents[agentName];
  if (agent.status === "done" && agent.sha256 === hash) return false;
  // A new version of the artifact: it still has to pass the structure check (structureOk stays false until then).
  const written: Partial<AgentState> = {
    status: "done",
    sha256: hash,
    updatedAt: now,
    lastError: null,
    feedback: null,
    structureOk: false,
    startsWithoutArtifact: 0,
  };
  Object.assign(agent, written);
  if (agentName === REQUIREMENTS_AGENT) resetExecutionPlan(state);

  const downstream = downstreamOf(agentName);
  markStale(state, downstream, () => `input artifact ${location.fileName} changed — regenerate`);
  resetPassedGates(state, [agentName, ...downstream]);
  const details = { agent: agentName, file: location.fileName, writer, sha256: hash.slice(0, HASH_PREVIEW_LENGTH) };
  appendLog(state, "artifact-written", details, now);
  return true;
};

// Feedback is cleared when the agent rewrites its artifact, so a kept feedback means the revision is still open.
const isAlreadyInvalidated = (state: WorkflowState, names: readonly AgentName[], feedback: string): boolean =>
  names.every((name) => state.agents[name].feedback === feedback && state.agents[name].status !== "done");

// Called by the coordinator after a human rejection when the feedback touches upstream agents.
// Returns false when the same invalidation is already in effect: a repeat must not reset an agent that is running.
export const invalidateAgents = (
  state: WorkflowState,
  names: readonly AgentName[],
  feedback: string,
  now: string,
): boolean => {
  for (const name of names) {
    if (artifactOf(name) === null) throw new Error(`${name} does not own an artifact and cannot be invalidated.`);
    if (state.agents[name].status === "skipped") {
      throw new Error(
        `${name} is not in the execution plan — revise ${REQUIREMENTS_AGENT} to change the requested services.`,
      );
    }
  }
  if (isAlreadyInvalidated(state, names, feedback)) return false;
  for (const name of names) {
    const agent = state.agents[name];
    if (agent.status !== "pending") agent.status = "stale";
    agent.feedback = feedback;
    agent.lastError = null;
  }
  const downstream = [...new Set(names.flatMap(downstreamOf))].filter((name) => !names.includes(name));
  markStale(state, downstream, () => "an upstream artifact is being revised — regenerate");
  resetPassedGates(state, [...names, ...downstream]);
  appendLog(state, "invalidated", { agents: names, feedback }, now);
  return true;
};

// The human confirmed the requirements in the clarify phase; the next step is the execution plan.
export const confirmRequirements = (state: WorkflowState, now: string): void => {
  state.requirementsConfirmed = true;
  appendLog(state, "requirements-confirmed", {}, now);
};
