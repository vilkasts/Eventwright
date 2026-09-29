// PostToolUse: every artifact write is recorded in workflow-state.json (status, sha256, downstream invalidation).
import { nowIso } from "@/io/clock";
import { sha256OfFile } from "@/io/files";
import { readHookInput } from "@/io/hook-io";
import { stateExists, updateState } from "@/io/state-store";
import { parseRunPath } from "@/lib/run-path";
import { recordArtifactWrite } from "@/lib/state";

const COORDINATOR_WRITER = "coordinator";

const recordWrite = async (): Promise<void> => {
  const input = await readHookInput();
  const location = parseRunPath(input.filePath ?? "");
  if (location === null || !stateExists(location.runId)) return;
  const hash = sha256OfFile(input.filePath ?? "");
  if (hash === null) return;
  const writer = input.agentType ?? COORDINATOR_WRITER;
  // Agents of one group finish together: the run lock keeps their concurrent updates from overwriting each other.
  updateState(location.runId, (state) => ({
    isChanged: recordArtifactWrite(state, location, hash, writer, nowIso()),
    result: null,
  }));
};

await recordWrite();
