import path from "node:path";
import process from "node:process";

import { APPROVAL_FILE, ARTIFACTS_AREA, OUTPUT_AREA, RUNS_DIRECTORY, STATE_FILE } from "@/config/workflow";

// Читается при каждом вызове: hooks и тесты указывают CLAUDE_PROJECT_DIR на другой checkout.
export const projectDirectory = (): string => process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
export const runsDirectory = (): string => path.join(projectDirectory(), RUNS_DIRECTORY);
export const runDirectory = (runId: string): string => path.join(runsDirectory(), runId);
export const statePath = (runId: string): string => path.join(runDirectory(runId), STATE_FILE);
export const approvalPath = (runId: string): string => path.join(runDirectory(runId), APPROVAL_FILE);
export const artifactsDirectory = (runId: string): string => path.join(runDirectory(runId), ARTIFACTS_AREA);
export const artifactPath = (runId: string, fileName: string): string => path.join(artifactsDirectory(runId), fileName);
export const outputDirectory = (runId: string): string => path.join(runDirectory(runId), OUTPUT_AREA);
