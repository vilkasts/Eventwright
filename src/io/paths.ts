// Where every file of a run lives on disk: <project>/runs/<runId>/...
import path from "node:path";
import process from "node:process";

import { APPROVAL_FILE, ARTIFACTS_AREA, OUTPUT_AREA, RUNS_DIRECTORY, STATE_FILE } from "@/config/workflow";

// Read on every call: hooks and tests point CLAUDE_PROJECT_DIR at another checkout.
// Claude Code sets CLAUDE_PROJECT_DIR for hooks; the CLI falls back to the current folder.
export const projectDirectory = (): string => process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
// <project>/runs
export const runsDirectory = (): string => path.join(projectDirectory(), RUNS_DIRECTORY);
// <project>/runs/<runId>
export const runDirectory = (runId: string): string => path.join(runsDirectory(), runId);
// <project>/runs/<runId>/workflow-state.json
export const statePath = (runId: string): string => path.join(runDirectory(runId), STATE_FILE);
// <project>/runs/<runId>/approval.json
export const approvalPath = (runId: string): string => path.join(runDirectory(runId), APPROVAL_FILE);
// <project>/runs/<runId>/artifacts
export const artifactsDirectory = (runId: string): string => path.join(runDirectory(runId), ARTIFACTS_AREA);
// <project>/runs/<runId>/artifacts/<fileName>
export const artifactPath = (runId: string, fileName: string): string => path.join(artifactsDirectory(runId), fileName);
// <project>/runs/<runId>/output
export const outputDirectory = (runId: string): string => path.join(runDirectory(runId), OUTPUT_AREA);
