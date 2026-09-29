import { FILE_TOOLS, SHELL_TOOLS } from "@/config/hooks";
import { OUTPUT_AREA, RUNS_DIRECTORY } from "@/config/workflow";
import { parseRunPath } from "@/lib/run-path";
import type { HookInput } from "@/types/hooks";

const SHELL_OUTPUT_PATH = new RegExp(`${RUNS_DIRECTORY}[\\\\/]([^\\\\/\\s"']+)[\\\\/]${OUTPUT_AREA}[\\\\/]`);
// Anything that can write a file from a shell. Read-only commands (cat, grep, ls, Get-Content) pass;
// a false positive here only asks for approval, a false negative would bypass it, so the list is broad.
const SHELL_WRITE =
  /(>|\btee\b|\bcp\b|\bmv\b|\btouch\b|\bsed\s+-i|\brm\b|\bln\b|\bdd\b|\binstall\b|\bpython\d?\b|\bnode\b|\bperl\b|\bruby\b|Set-Content|Add-Content|Out-File|New-Item|Copy-Item|Move-Item|Remove-Item|WriteAll)/i;

// The run whose final document a tool tries to write (as a file or via a shell), or null.
export const outputRunId = (input: HookInput): string | null => {
  const tool = input.toolName ?? "";
  if (FILE_TOOLS.includes(tool)) {
    const location = parseRunPath(input.filePath ?? "");
    return location?.area === OUTPUT_AREA ? location.runId : null;
  }
  const command = input.command ?? "";
  if (!SHELL_TOOLS.includes(tool) || !SHELL_WRITE.test(command)) return null;
  const [, runId] = SHELL_OUTPUT_PATH.exec(command) ?? [];
  return runId ?? null;
};
