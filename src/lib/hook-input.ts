// Turns the raw JSON that Claude Code sends to a hook into a small, typed HookInput.
import { isRecord, listOf, stringOrNull } from "@/lib/narrow";
import type { HookInput } from "@/types/hooks";

// The replacement texts of a MultiEdit call (each edit has its own new_string).
const editedTexts = (edits: unknown): string[] =>
  listOf(edits)
    .map((edit) => (isRecord(edit) ? stringOrNull(edit.new_string) : null))
    .filter((text) => text !== null);

// The Claude Code payload arrives as unknown: take only the needed fields, and only of the expected types.
// A malformed payload never throws here; missing fields simply become null or "".
export const parseHookInput = (raw: unknown): HookInput => {
  const payload = isRecord(raw) ? raw : {};
  const toolInput = isRecord(payload.tool_input) ? payload.tool_input : {};
  const texts = [stringOrNull(toolInput.content), stringOrNull(toolInput.new_string), ...editedTexts(toolInput.edits)];
  return {
    toolName: stringOrNull(payload.tool_name),
    filePath: stringOrNull(toolInput.file_path),
    command: stringOrNull(toolInput.command),
    skill: stringOrNull(toolInput.skill),
    writtenText: texts.filter((text) => text !== null).join("\n"),
    prompt: stringOrNull(payload.prompt) ?? stringOrNull(payload.prompt_text),
    agentType: stringOrNull(payload.agent_type),
  };
};
