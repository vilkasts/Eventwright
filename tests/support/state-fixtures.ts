// Test helpers for run state: a fixed time and a way to mark agents as finished.
import { ARTIFACTS_AREA } from "@/config/workflow";
import { requireArtifactOf } from "@/lib/dag-queries";
import { recordArtifactWrite } from "@/lib/state";
import type { AgentName, WorkflowState } from "@/types/workflow";

// A fixed timestamp, so test results do not depend on the clock.
export const NOW = "2026-09-28T10:00:00.000Z";

// The agents of the domain stage, in graph order.
export const DOMAIN_AGENTS: readonly AgentName[] = [
  "requirements-formalizer",
  "weather-analyst",
  "venue-scout",
  "catering-planner",
  "entertainment-planner",
  "logistics-planner",
  "budget-aggregator",
];

// Simulates "the agent wrote its artifact (post-write-state hook) and the coordinator's structure check passed".
export const markDone = (state: WorkflowState, names: readonly AgentName[]): void => {
  for (const name of names) {
    const location = { runId: state.runId, area: ARTIFACTS_AREA, fileName: requireArtifactOf(name) };
    recordArtifactWrite(state, location, `hash-${name}`, "test", NOW);
    state.agents[name].structureOk = true;
  }
};
