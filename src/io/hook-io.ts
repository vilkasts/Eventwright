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
export const denyToolUse = (reason: string): never => {
  const decision = { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason };
  process.stdout.write(JSON.stringify({ hookSpecificOutput: decision }));
  process.exit(0);
};

// UserPromptSubmit block: exit 2, the message reaches the human via stderr.
export const blockPrompt = (source: string, message: string): never => {
  process.stderr.write(`[${source}] ${message}\n`);
  process.exit(HOOK_BLOCK_EXIT_CODE);
};

export const reportToContext = (source: string, message: string): void => {
  process.stdout.write(`[${source}] ${message}\n`);
};
