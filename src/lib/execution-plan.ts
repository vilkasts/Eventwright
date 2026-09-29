// The execution plan: which optional planners run in this run, based on the services the human confirmed.
import { DAG } from "@/config/dag";
import { VENUE_SERVICE } from "@/config/workflow";
import { OPTIONAL_AGENTS } from "@/lib/dag-queries";
import { isOneOf } from "@/lib/narrow";
import { appendLog } from "@/lib/state";
import { AGENT_NAMES, GATE_IDS, SERVICES } from "@/types/workflow";
import type { ExecutionPlan, RequestedService, WorkflowState } from "@/types/workflow";

// Every value the "- Services:" line may contain.
const REQUESTED_SERVICES: readonly RequestedService[] = [VENUE_SERVICE, ...SERVICES];
const SERVICES_LINE = /^\s*- Services:\s*(.+)$/m;

// The "- Services: venue, catering, …" line is written by the formalizer and confirmed by the human.
// Returns the listed services (lower case, no duplicates), or null if the line is missing.
export const parseServices = (requirementsText: string): string[] | null => {
  const list = SERVICES_LINE.exec(requirementsText)?.[1];
  if (list === undefined) return null;
  const services = list
    .split(",")
    .map((service) => service.trim().toLowerCase())
    .filter((service) => service.length > 0);
  return [...new Set(services)];
};

// Dynamic subagent selection: planners of services not requested are skipped and their gates become n/a.
// Called once per run by `wf plan`; an unknown service name is rejected before anything changes.
export const applyExecutionPlan = (state: WorkflowState, services: readonly string[], now: string): ExecutionPlan => {
  const unknown = services.filter((service) => !isOneOf(REQUESTED_SERVICES, service));
  if (unknown.length > 0) {
    throw new Error(`Unknown services: ${unknown.join(", ")}. Known: ${REQUESTED_SERVICES.join(", ")}.`);
  }
  const requested = REQUESTED_SERVICES.filter((service) => services.includes(service));
  const skipped = OPTIONAL_AGENTS.filter((name) => {
    const service = DAG.agents[name].service;
    return service !== undefined && !requested.includes(service);
  });
  for (const name of skipped) {
    const agent = state.agents[name];
    agent.status = "skipped";
    agent.lastError = null;
    agent.feedback = null;
  }
  for (const id of GATE_IDS) {
    if (DAG.gates[id].owners.every((owner) => skipped.includes(owner))) {
      state.gates[id] = { status: "n/a", attempts: 0, findings: [] };
    }
  }
  const selected = AGENT_NAMES.filter((name) => !skipped.includes(name));
  state.plan = { services: requested, selected, skipped, at: now };
  appendLog(state, "execution-plan", { selected, skipped }, now);
  return state.plan;
};
