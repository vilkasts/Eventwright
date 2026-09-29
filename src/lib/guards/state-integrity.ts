import { COMMAND_TOOLS, FILE_TOOLS, HUMAN_ONLY_COMMANDS, SHELL_TOOLS, WORKFLOW_CLI_PREFIX } from "@/config/hooks";
import { APPROVAL_FILE, STATE_FILE } from "@/config/workflow";
import type { HookInput } from "@/types/hooks";

// Lower-cased: Windows and macOS file systems ignore case, so Approval.JSON is the same file (F03).
const PROTECTED_FILES = [STATE_FILE, APPROVAL_FILE].map((file) => file.toLowerCase());
// Anything that can chain a second command or redirect output after an allowed `wf` call (F08).
const SHELL_CHAINING = /[;&|<>`]|\$\(/;

const baseName = (filePath: string): string => filePath.replace(/\\/g, "/").split("/").at(-1) ?? "";

// The file itself or one of its temporary files (workflow-state.json.<id>.tmp).
const isProtectedName = (name: string): boolean => {
  const lower = name.toLowerCase();
  return PROTECTED_FILES.some((file) => lower === file || lower.startsWith(`${file}.`));
};

const mentions = (command: string, file: string): boolean => command.toLowerCase().includes(file.toLowerCase());

const invokedCommand = (input: HookInput): string =>
  (input.skill ?? input.command ?? "").trim().replace(/^\//, "").split(/\s+/)[0] ?? "";

const fileViolation = (input: HookInput): string | null => {
  const name = baseName(input.filePath ?? "");
  return isProtectedName(name) ? `state-integrity-guard: ${name} is changed only by the workflow CLI and hooks.` : null;
};

const isSingleWorkflowCall = (command: string): boolean =>
  WORKFLOW_CLI_PREFIX.test(command) && !SHELL_CHAINING.test(command);

const shellViolation = (command: string): string | null => {
  if (mentions(command, APPROVAL_FILE)) {
    return `state-integrity-guard: ${APPROVAL_FILE} is written only by the record-approval hook; read it with the Read tool.`;
  }
  if (mentions(command, STATE_FILE) && !isSingleWorkflowCall(command)) {
    return "state-integrity-guard: change state only via `npm run -s wf -- …`; read it with Read or `wf status`.";
  }
  return null;
};

// PreToolUse: workflow-state.json and approval.json change only via the CLI and hooks; only a human approves.
export const stateIntegrityViolation = (input: HookInput): string | null => {
  const tool = input.toolName ?? "";
  if (FILE_TOOLS.includes(tool)) return fileViolation(input);
  if (SHELL_TOOLS.includes(tool)) return shellViolation(input.command ?? "");
  if (COMMAND_TOOLS.includes(tool) && HUMAN_ONLY_COMMANDS.includes(invokedCommand(input))) {
    return "state-integrity-guard: only a human may approve or reject a plan by typing the command.";
  }
  return null;
};
