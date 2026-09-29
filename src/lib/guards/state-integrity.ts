import { COMMAND_TOOLS, FILE_TOOLS, HUMAN_ONLY_COMMANDS, SHELL_TOOLS, WORKFLOW_CLI_PREFIX } from "@/config/hooks";
import { APPROVAL_FILE, STATE_FILE } from "@/config/workflow";
import type { HookInput } from "@/types/hooks";

const TEMPORARY_SUFFIX = ".tmp";
const PROTECTED_FILES = [STATE_FILE, APPROVAL_FILE].flatMap((file) => [file, `${file}${TEMPORARY_SUFFIX}`]);

const baseName = (filePath: string): string => filePath.replace(/\\/g, "/").split("/").at(-1) ?? "";

const invokedCommand = (input: HookInput): string =>
  (input.skill ?? input.command ?? "").trim().replace(/^\//, "").split(/\s+/)[0] ?? "";

const fileViolation = (input: HookInput): string | null => {
  const name = baseName(input.filePath ?? "");
  return PROTECTED_FILES.includes(name)
    ? `state-integrity-guard: ${name} is changed only by the workflow CLI and hooks.`
    : null;
};

const shellViolation = (command: string): string | null => {
  if (command.includes(APPROVAL_FILE)) {
    return `state-integrity-guard: ${APPROVAL_FILE} is written only by the record-approval hook; read it with the Read tool.`;
  }
  if (command.includes(STATE_FILE) && !WORKFLOW_CLI_PREFIX.test(command)) {
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
