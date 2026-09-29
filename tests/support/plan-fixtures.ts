// Test helpers for the execution plan.
import { VENUE_SERVICE } from "@/config/workflow";
import { applyExecutionPlan } from "@/lib/execution-plan";
import { SERVICES } from "@/types/workflow";
import type { WorkflowState } from "@/types/workflow";
import { NOW } from "@tests/support/state-fixtures";

// Every service, so every planner runs.
export const ALL_SERVICES: readonly string[] = [VENUE_SERVICE, ...SERVICES];

// Simulates "the human confirmed the requirements and the coordinator applied the execution plan".
export const confirmWithPlan = (state: WorkflowState, services: readonly string[] = ALL_SERVICES): void => {
  state.requirementsConfirmed = true;
  applyExecutionPlan(state, services, NOW);
};
