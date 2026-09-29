// PostToolUse: каждая запись артефакта фиксируется в workflow-state.json (статус, sha256, инвалидация downstream).
import { nowIso } from "@/io/clock";
import { sha256OfFile } from "@/io/files";
import { readHookInput } from "@/io/hook-io";
import { loadState, saveState, stateExists } from "@/io/state-store";
import { parseRunPath } from "@/lib/run-path";
import { recordArtifactWrite } from "@/lib/state";

const COORDINATOR_WRITER = "coordinator";

const recordWrite = async (): Promise<void> => {
  const input = await readHookInput();
  const location = parseRunPath(input.filePath ?? "");
  if (location === null || !stateExists(location.runId)) return;
  const hash = sha256OfFile(input.filePath ?? "");
  if (hash === null) return;
  const state = loadState(location.runId);
  const writer = input.agentType ?? COORDINATOR_WRITER;
  if (recordArtifactWrite(state, location, hash, writer, nowIso())) saveState(state);
};

await recordWrite();
