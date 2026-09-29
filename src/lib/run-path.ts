// Recognizing files that belong to a run: runs/<runId>/artifacts/<file> or runs/<runId>/output/<file>.
import { RUNS_DIRECTORY } from "@/config/workflow";
import { isOneOf } from "@/lib/narrow";
import type { ArtifactArea, RunLocation } from "@/types/workflow";

// The two run folders that agents write into.
const AREAS: readonly ArtifactArea[] = ["artifacts", "output"];
// Matches ".../runs/<runId>/<area>/<fileName>" at the end of a path.
const RUN_FILE = new RegExp(`/${RUNS_DIRECTORY}/([^/]+)/([^/]+)/([^/]+)$`);
// Lowercase kebab-case (e.g. 2026-09-28-lisbon): no separators or dots, so a run id never leaves runs/ (F10).
const RUN_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// True for a valid run id like "2026-09-28-lisbon".
export const isRunId = (value: string): boolean => RUN_ID.test(value);

// Hook payload paths are absolute; on Windows they use backslashes.
// Returns where the file sits in a run, or null for any other file (source code, run root files, …).
export const parseRunPath = (filePath: string): RunLocation | null => {
  const match = RUN_FILE.exec(filePath.replace(/\\/g, "/"));
  const [, runId, area, fileName] = match ?? [];
  if (runId === undefined || fileName === undefined || !isOneOf(AREAS, area)) return null;
  return { runId, area, fileName };
};
