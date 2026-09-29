import { loadState, stateExists } from "@/io/state-store";
import type { WorkflowState } from "@/types/workflow";

export const requireRun = (runId: string | undefined): WorkflowState => {
  if (runId === undefined || !stateExists(runId)) throw new Error(`Run '${runId ?? ""}' not found under runs/.`);
  return loadState(runId);
};
