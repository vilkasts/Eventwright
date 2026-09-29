import { RUNS_DIRECTORY } from "@/config/workflow";
import { isOneOf } from "@/lib/narrow";
import type { ArtifactArea, RunLocation } from "@/types/workflow";

const AREAS: readonly ArtifactArea[] = ["artifacts", "output"];
const RUN_FILE = new RegExp(`/${RUNS_DIRECTORY}/([^/]+)/([^/]+)/([^/]+)$`);

// Hook payload paths are absolute; on Windows they use backslashes.
export const parseRunPath = (filePath: string): RunLocation | null => {
  const match = RUN_FILE.exec(filePath.replace(/\\/g, "/"));
  const [, runId, area, fileName] = match ?? [];
  if (runId === undefined || fileName === undefined || !isOneOf(AREAS, area)) return null;
  return { runId, area, fileName };
};
