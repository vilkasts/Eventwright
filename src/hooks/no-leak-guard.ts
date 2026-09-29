// PreToolUse: the human-facing document must not expose workflow internals.
import { FILE_TOOLS } from "@/config/hooks";
import { OUTPUT_AREA } from "@/config/workflow";
import { guardToolUse } from "@/io/hook-io";
import { findLeaks } from "@/lib/guards/leaks";
import { parseRunPath } from "@/lib/run-path";

await guardToolUse("no-leak-guard", (input) => {
  const isOutputWrite =
    FILE_TOOLS.includes(input.toolName ?? "") && parseRunPath(input.filePath ?? "")?.area === OUTPUT_AREA;
  const leaks = isOutputWrite ? findLeaks(input.writtenText) : [];
  if (leaks.length === 0) return null;
  return `no-leak-guard: the user-facing document mentions internal workflow details: ${leaks.join(", ")}. Rephrase for a human reader.`;
});
