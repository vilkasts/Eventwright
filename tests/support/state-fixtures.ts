import { ARTIFACTS_AREA } from "@/config/workflow";
import { requireArtifactOf } from "@/lib/dag-queries";
import { recordArtifactWrite } from "@/lib/state";
import type { AgentName, WorkflowState } from "@/types/workflow";

export const NOW = "2026-09-28T10:00:00.000Z";

export const DOMAIN_AGENTS: readonly AgentName[] = [
  "requirements-formalizer",
  "weather-analyst",
  "venue-scout",
  "catering-planner",
  "entertainment-planner",
  "logistics-planner",
  "budget-aggregator",
];

// Имитирует «агент записал артефакт (hook post-write-state) и структурная проверка координатора прошла».
export const markDone = (state: WorkflowState, names: readonly AgentName[]): void => {
  for (const name of names) {
    const location = { runId: state.runId, area: ARTIFACTS_AREA, fileName: requireArtifactOf(name) };
    recordArtifactWrite(state, location, `hash-${name}`, "test", NOW);
    state.agents[name].structureOk = true;
  }
};
