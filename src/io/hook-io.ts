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

// Отказ PreToolUse по контракту Claude Code: JSON с permissionDecision и exit 0.
export const denyToolUse = (reason: string): never => {
  const decision = { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason };
  process.stdout.write(JSON.stringify({ hookSpecificOutput: decision }));
  process.exit(0);
};

// Блокировка UserPromptSubmit: exit 2, сообщение уходит человеку через stderr.
export const blockPrompt = (source: string, message: string): never => {
  process.stderr.write(`[${source}] ${message}\n`);
  process.exit(HOOK_BLOCK_EXIT_CODE);
};

export const reportToContext = (source: string, message: string): void => {
  process.stdout.write(`[${source}] ${message}\n`);
};
