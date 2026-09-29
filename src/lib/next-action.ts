import { DAG } from "@/config/dag";
import { OUTPUT_AGENT, PLAN_AGENT, REQUIREMENTS_AGENT, STAGE_ORDER } from "@/config/workflow";
import { isApprovalCurrent } from "@/lib/approval-status";
import { agentNamesForStage, artifactOf, gateIdsForStage, outputFiles } from "@/lib/dag-queries";
import { AGENT_NAMES } from "@/types/workflow";
import type { ApprovalFile } from "@/types/approval";
import type { Action, AgentName, Brief, BriefMode, GatedStage, WorkflowState } from "@/types/workflow";

const briefMode = (state: WorkflowState, name: AgentName): BriefMode => {
  const agent = state.agents[name];
  if (agent.feedback !== null) return "revise";
  return agent.status === "pending" ? "initial" : "retry";
};

const buildBrief = (state: WorkflowState, name: AgentName): Brief => ({
  name,
  artifact: artifactOf(name),
  inputs: DAG.agents[name].deps
    .filter((dependency) => state.agents[dependency].status !== "skipped")
    .map(artifactOf)
    .filter((artifact) => artifact !== null),
  mode: briefMode(state, name),
  reason: state.agents[name].lastError,
  feedback: state.agents[name].feedback,
});

const isDone = (state: WorkflowState, name: AgentName): boolean =>
  state.agents[name].status === "done" || state.agents[name].status === "skipped";

// A crash between writing an artifact and checking it must not let unchecked work move on.
const uncheckedAgents = (state: WorkflowState): AgentName[] =>
  AGENT_NAMES.filter(
    (name) => artifactOf(name) !== null && state.agents[name].status === "done" && !state.agents[name].structureOk,
  );

const stageAction = (state: WorkflowState, stage: GatedStage): Action | null => {
  const runnable = agentNamesForStage(stage).filter(
    (name) => !isDone(state, name) && DAG.agents[name].deps.every((dependency) => isDone(state, dependency)),
  );
  if (runnable.length > 0) return { action: "run", agents: runnable.map((name) => buildBrief(state, name)) };

  const gateIds = gateIdsForStage(stage);
  const recheck = gateIds.filter((id) => state.gates[id].status !== "pass" && state.gates[id].status !== "n/a");
  if (recheck.length === 0) return null;
  const report = state.validation[stage];
  if (report !== null && !report.recorded) return { action: "record-gates", stage };
  const notApplicable = gateIds.filter((id) => state.gates[id].status === "n/a");
  return { action: "validate", stage, recheck, notApplicable };
};

// The next step is computed by code, not by the model: the coordinator only executes it.
export const nextAction = (state: WorkflowState, approval: ApprovalFile | null): Action => {
  if (state.failure !== null) return { action: "failed", failure: state.failure };

  const unchecked = uncheckedAgents(state);
  if (unchecked.length > 0) return { action: "check", agents: unchecked };

  if (!isDone(state, REQUIREMENTS_AGENT)) return { action: "run", agents: [buildBrief(state, REQUIREMENTS_AGENT)] };
  if (!state.requirementsConfirmed) return { action: "clarify" };
  if (state.plan === null) return { action: "plan" };

  for (const stage of STAGE_ORDER) {
    const action = stageAction(state, stage);
    if (action !== null) return action;
  }

  const planSha256 = state.agents[PLAN_AGENT].sha256;
  if (!isApprovalCurrent(approval, planSha256)) return { action: "await-approval", planSha256 };
  if (!isDone(state, OUTPUT_AGENT)) return { action: "run", agents: [buildBrief(state, OUTPUT_AGENT)] };
  return { action: "done", outputs: outputFiles() };
};
