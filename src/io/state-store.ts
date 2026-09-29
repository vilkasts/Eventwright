import { mkdirSync, readdirSync } from "node:fs";

import { SCHEMA_VERSION } from "@/config/workflow";
import { nowIso } from "@/io/clock";
import { fileExists, readJson, writeJsonAtomic } from "@/io/files";
import { artifactsDirectory, outputDirectory, runsDirectory, statePath } from "@/io/paths";
import { withRunLock } from "@/io/run-lock";
import { isWorkflowState } from "@/lib/schemas/workflow-state";
import type { WorkflowState } from "@/types/workflow";

export const stateExists = (runId: string): boolean => fileExists(statePath(runId));

export const loadState = (runId: string): WorkflowState => {
  const raw = readJson(statePath(runId));
  if (!isWorkflowState(raw)) {
    throw new Error(`${statePath(runId)} is not a valid workflow state (schema ${SCHEMA_VERSION}).`);
  }
  return raw;
};

export const saveState = (state: WorkflowState, now: string = nowIso()): void => {
  state.updatedAt = now;
  writeJsonAtomic(statePath(state.runId), state);
};

export type StateUpdate<T> = { isChanged: boolean; result: T };

// The only safe way to change an existing run: load, mutate and save under the run lock.
// The state is saved only when the mutation reports a change.
export const updateState = <T>(runId: string, mutate: (state: WorkflowState) => StateUpdate<T>): T =>
  withRunLock(runId, () => {
    const state = loadState(runId);
    const { isChanged, result } = mutate(state);
    if (isChanged) saveState(state);
    return result;
  });

// New run: artifact and output folders plus the initial state.
export const createRun = (state: WorkflowState): void => {
  mkdirSync(artifactsDirectory(state.runId), { recursive: true });
  mkdirSync(outputDirectory(state.runId), { recursive: true });
  saveState(state, state.createdAt);
};

export const listRunIds = (): string[] =>
  fileExists(runsDirectory()) ? readdirSync(runsDirectory()).filter(stateExists) : [];
