// Guard policy: only the agent that owns an artifact may write it (used by the state-integrity-guard hook).
import { FILE_TOOLS } from "@/config/hooks";
import { ARTIFACTS_AREA, STAGE_ORDER, VALIDATOR_NAME, validationFileName } from "@/config/workflow";
import { agentForFile } from "@/lib/dag-queries";
import { parseRunPath } from "@/lib/run-path";
import type { HookInput } from "@/types/hooks";
import type { RunLocation } from "@/types/workflow";

// How the main session is named in messages (it has no agent type).
const COORDINATOR = "the coordinator";

// Who may write a file of a run: the validator for its reports, otherwise the owner from the graph (or nobody).
const ownerOf = (location: RunLocation): string | null => {
  const isReport =
    location.area === ARTIFACTS_AREA && STAGE_ORDER.some((stage) => validationFileName(stage) === location.fileName);
  return isReport ? VALIDATOR_NAME : agentForFile(location.area, location.fileName);
};

// Every artifact has exactly one owner (src/config/dag.ts); post-write-state records any write as the owner's
// work, so a write by another agent or by the coordinator (invariant 1) is denied before it happens.
export const artifactOwnerViolation = (input: HookInput): string | null => {
  if (!FILE_TOOLS.includes(input.toolName ?? "")) return null;
  const location = parseRunPath(input.filePath ?? "");
  const owner = location === null ? null : ownerOf(location);
  if (location === null || owner === null || input.agentType === owner) return null;
  return (
    `state-integrity-guard: ${location.fileName} is owned by ${owner}; ${input.agentType ?? COORDINATOR} must not write it. ` +
    "Write only your own artifact; the coordinator launches the owner instead."
  );
};
