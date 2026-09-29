import { FILE_TOOLS, SHELL_TOOLS } from "@/config/hooks";
import { OUTPUT_AREA, RUNS_DIRECTORY } from "@/config/workflow";
import { parseRunPath } from "@/lib/run-path";
import type { HookInput } from "@/types/hooks";

const SHELL_OUTPUT_PATH = new RegExp(`${RUNS_DIRECTORY}[\\\\/]([^\\\\/\\s"']+)[\\\\/]${OUTPUT_AREA}[\\\\/]`);

// Run, в чей итоговый документ пытается писать инструмент (файлом или через shell), либо null.
export const outputRunId = (input: HookInput): string | null => {
  const tool = input.toolName ?? "";
  if (FILE_TOOLS.includes(tool)) {
    const location = parseRunPath(input.filePath ?? "");
    return location?.area === OUTPUT_AREA ? location.runId : null;
  }
  if (!SHELL_TOOLS.includes(tool)) return null;
  const [, runId] = SHELL_OUTPUT_PATH.exec(input.command ?? "") ?? [];
  return runId ?? null;
};
