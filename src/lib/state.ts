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

export const appendLog = (state: WorkflowState, event: string, details: Record<string, unknown>, now: string): void => {
  state.log.push({ at: now, event, details });
};

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

const validationStageOf = (location: RunLocation): GatedStage | null => {
  if (location.area !== ARTIFACTS_AREA) return null;
  return STAGE_ORDER.find((stage) => validationFileName(stage) === location.fileName) ?? null;
};

const recordOutputWrite = (state: WorkflowState, fileName: string, hash: string, writer: string, now: string): void => {
  const agent = state.agents[OUTPUT_AGENT];
  agent.outputs[fileName] = hash;
  agent.startsWithoutArtifact = 0;
  if (outputFiles().every((file) => agent.outputs[file] !== undefined)) {
    agent.status = "done";
    agent.updatedAt = now;
  }
  appendLog(state, "output-written", { file: fileName, writer }, now);
};

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
    state.validation[validationStage] = { sha256: hash, recorded: false, at: now };
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

// Called by the coordinator after a human rejection when the feedback touches upstream agents.
export const invalidateAgents = (
  state: WorkflowState,
  names: readonly AgentName[],
  feedback: string,
  now: string,
): void => {
  for (const name of names) {
    if (artifactOf(name) === null) throw new Error(`${name} does not own an artifact and cannot be invalidated.`);
    if (state.agents[name].status === "skipped") {
      throw new Error(
        `${name} is not in the execution plan — revise ${REQUIREMENTS_AGENT} to change the requested services.`,
      );
    }
  }
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
};

export const confirmRequirements = (state: WorkflowState, now: string): void => {
  state.requirementsConfirmed = true;
  appendLog(state, "requirements-confirmed", {}, now);
};
