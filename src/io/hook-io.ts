import process from "node:process";

import { HOOK_BLOCK_EXIT_CODE } from "@/config/hooks";
import { parseHookInput } from "@/lib/hook-input";
import type { HookInput } from "@/types/hooks";

export const readHookInput = async (): Promise<HookInput> => {
  let raw = "";
  for await (const chunk of process.stdin) raw += String(chunk);
  const payload: unknown = raw.trim().length > 0 ? JSON.parse(raw) : {};
  return parseHookInput(payload);
};

// PreToolUse denial per the Claude Code contract: JSON with permissionDecision and exit 0.
// No process.exit: on macOS a pipe write is asynchronous and could be cut off, and a truncated
// answer would let the tool run. The hook ends on its own once stdout is flushed.
const denyToolUse = (reason: string): void => {
  const decision = { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason };
  process.stdout.write(JSON.stringify({ hookSpecificOutput: decision }));
};

// UserPromptSubmit block: exit 2, the message reaches the human via stderr.
export const blockPrompt = (source: string, message: string): never => {
  process.stderr.write(`[${source}] ${message}\n`);
  process.exit(HOOK_BLOCK_EXIT_CODE);
};

export const reportToContext = (source: string, message: string): void => {
  process.stdout.write(`[${source}] ${message}\n`);
};

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

// PreToolUse guards fail closed: exit code 1 would let Claude Code run the tool, so an error while
// deciding (corrupt JSON, unreadable file) denies the call and names the cause (F04).
export const guardToolUse = async (source: string, check: (input: HookInput) => string | null): Promise<void> => {
  let violation: string | null;
  try {
    violation = check(await readHookInput());
  } catch (error) {
    violation = `${source}: the check failed (${errorMessage(error)}) — fix the file named in the error, then retry.`;
  }
  if (violation !== null) denyToolUse(violation);
};

// Non-guard hooks: an error is shown to Claude (exit 2 + stderr) instead of being dropped silently.
export const runHookSafely = async (source: string, body: () => Promise<void>): Promise<void> => {
  try {
    await body();
  } catch (error) {
    blockPrompt(source, errorMessage(error));
  }
};
