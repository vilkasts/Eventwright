// The heart of the workflow: from the saved state it decides what the coordinator must do next.
// `npm run -s wf -- next <runId>` prints this decision as JSON.
import { DAG } from "@/config/dag";
import { OUTPUT_AGENT, PLAN_AGENT, REQUIREMENTS_AGENT, STAGE_ORDER } from "@/config/workflow";
import { isApprovalCurrent } from "@/lib/approval-status";
import { agentNamesForStage, artifactOf, gateIdsForStage, outputFiles } from "@/lib/dag-queries";
import { AGENT_NAMES } from "@/types/workflow";
import type { ApprovalFile } from "@/types/approval";
import type { Action, AgentName, Brief, BriefMode, GatedStage, WorkflowState } from "@/types/workflow";

// Why the agent is launched: human feedback → revise; never ran → initial; anything else → retry.
const briefMode = (state: WorkflowState, name: AgentName): BriefMode => {
  const agent = state.agents[name];
  if (agent.feedback !== null) return "revise";
  return agent.status === "pending" ? "initial" : "retry";
};

// What the coordinator passes to an agent. Inputs leave out artifacts of skipped agents (they do not exist).
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

// An agent needs no more work: it finished, or it was skipped by the execution plan.
const isDone = (state: WorkflowState, name: AgentName): boolean =>
  state.agents[name].status === "done" || state.agents[name].status === "skipped";

// A crash between writing an artifact and checking it must not let unchecked work move on.
const uncheckedAgents = (state: WorkflowState): AgentName[] =>
  AGENT_NAMES.filter(
    (name) => artifactOf(name) !== null && state.agents[name].status === "done" && !state.agents[name].structureOk,
  );

// The next step inside one stage, or null when the stage is complete:
// 1) run every agent whose inputs are ready (one group, launched in parallel);
// 2) once all agents are done, record an unrecorded validator report or ask for a validation.
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
// The checks run in a fixed order: stopped run → unchecked artifacts → requirements → human confirmation →
// execution plan → domain stage → final stage → human approval → HTML → done.
// Because it depends only on the saved state, the same call also resumes an interrupted run.
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
