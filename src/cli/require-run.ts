import { loadState, stateExists, updateState } from "@/io/state-store";
import type { StateUpdate } from "@/io/state-store";
import { isRunId } from "@/lib/run-path";
import type { WorkflowState } from "@/types/workflow";

const existingRunId = (runId: string | undefined): string => {
  if (runId !== undefined && !isRunId(runId)) {
    throw new Error(`Invalid run id '${runId}': use lowercase letters, digits and hyphens only.`);
  }
  if (runId === undefined || !stateExists(runId)) throw new Error(`Run '${runId ?? ""}' not found under runs/.`);
  return runId;
};

// Read-only access to a run.
export const requireRun = (runId: string | undefined): WorkflowState => loadState(existingRunId(runId));

// Every command that changes a run goes through the run lock (see updateState).
export const updateRun = <T>(runId: string | undefined, mutate: (state: WorkflowState) => StateUpdate<T>): T =>
  updateState(existingRunId(runId), mutate);
